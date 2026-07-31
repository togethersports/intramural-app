// The whole backend in one file: Supabase REST, no SDK. The watch signs in
// with its OWN session rather than borrowing the phone's — Supabase rotates
// refresh tokens per session family, so two devices sharing one family
// invalidate each other within hours. Independent sign-in (one time, kept in
// the keychain) is what makes the watch work standalone at a school where
// the phone stayed home.
//
// Queries mirror mobile/lib/data.ts — same embedded selects, same RLS.

import Foundation
import Security

enum Supabase {
  // Same public pair as eas.json build profiles. The anon key is designed to
  // be public; RLS is what protects the data.
  static let url = URL(string: "https://qayvyjgzfkafrhtchjub.supabase.co")!
  static let anonKey = "sb_publishable_C0EqnKDL_FV2wY6_A154yw_SAf529YR"
}

struct ApiError: LocalizedError {
  let message: String
  var errorDescription: String? { message }
}

// ------------------------------------------------------------------ keychain

enum Keychain {
  private static let service = "app.intramural.ios.watch"

  static func save(_ data: Data, key: String) {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: key,
    ]
    SecItemDelete(query as CFDictionary)
    var add = query
    add[kSecValueData as String] = data
    add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
    SecItemAdd(add as CFDictionary, nil)
  }

  static func load(key: String) -> Data? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: key,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var out: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess else { return nil }
    return out as? Data
  }

  static func delete(key: String) {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: key,
    ]
    SecItemDelete(query as CFDictionary)
  }
}

// -------------------------------------------------------------------- models

struct AuthUser: Codable {
  let id: String
  let email: String?
}

struct AuthSession: Codable {
  let accessToken: String
  let refreshToken: String
  let expiresIn: Double
  let user: AuthUser
}

/// What survives a relaunch (keychain). The access token is short-lived and
/// deliberately not persisted.
struct StoredSession: Codable {
  var refreshToken: String
  var userId: String
  var email: String
}

struct TeamRef: Codable {
  let name: String
  let abbrev: String
  let color: String
}

struct SlotRef: Codable { let label: String? }
struct VenueRef: Codable { let name: String? }

struct Game: Codable, Identifiable {
  let id: String
  let week: Int
  let scheduledDate: String?
  let status: String
  let homeScore: Int
  let awayScore: Int
  let isPlayoff: Bool
  let homeTeamId: String
  let awayTeamId: String
  let homeTeam: TeamRef?
  let awayTeam: TeamRef?
  let timeSlot: SlotRef?
  let venue: VenueRef?

  var isFinal: Bool { status == "final" || status == "forfeit" }
  var isUpcoming: Bool { status == "scheduled" || status == "live" }
}

struct TeamLite: Codable, Identifiable {
  let id: String
  let name: String
  let abbrev: String
  let color: String
}

struct TimeSlot: Codable, Identifiable {
  let id: String
  let label: String
  let dayOfWeek: Int
  let startTime: String
  let endTime: String
}

struct AvailabilityRow: Codable {
  let timeSlotId: String
  let status: String
}

struct MyTeam {
  let teamId: String
  let teamName: String
  let teamAbbrev: String
  let teamColor: String
  let seasonId: String
  let leagueId: String
  let leagueName: String
}

struct StandingRow: Identifiable {
  let id: String
  let name: String
  let color: String
  let w: Int
  let l: Int
  let diff: Int
}

// ----------------------------------------------------------------- api store

@MainActor
final class Api: ObservableObject {
  @Published var stored: StoredSession?

  private var accessToken: String?
  private var accessExpiry = Date.distantPast

  private static let decoder: JSONDecoder = {
    let d = JSONDecoder()
    d.keyDecodingStrategy = .convertFromSnakeCase
    return d
  }()

  init() {
    if let data = Keychain.load(key: "session") {
      stored = try? Self.decoder.decode(StoredSession.self, from: data)
    }
  }

  var isSignedIn: Bool { stored != nil }

  // ------------------------------------------------------------------ auth

  func signIn(email: String, password: String) async throws {
    let session = try await tokenRequest(
      grant: "password",
      body: ["email": email, "password": password]
    )
    adopt(session)
  }

  func signOut() {
    Keychain.delete(key: "session")
    stored = nil
    accessToken = nil
    accessExpiry = .distantPast
  }

  private func adopt(_ session: AuthSession) {
    accessToken = session.accessToken
    accessExpiry = Date().addingTimeInterval(session.expiresIn - 60)
    let s = StoredSession(
      refreshToken: session.refreshToken,
      userId: session.user.id,
      email: session.user.email ?? ""
    )
    stored = s
    if let data = try? JSONEncoder().encode(s) {
      Keychain.save(data, key: "session")
    }
  }

  private func tokenRequest(grant: String, body: [String: String]) async throws -> AuthSession {
    var comps = URLComponents(
      url: Supabase.url.appendingPathComponent("auth/v1/token"),
      resolvingAgainstBaseURL: false
    )!
    comps.queryItems = [URLQueryItem(name: "grant_type", value: grant)]
    var req = URLRequest(url: comps.url!)
    req.httpMethod = "POST"
    req.setValue(Supabase.anonKey, forHTTPHeaderField: "apikey")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try JSONSerialization.data(withJSONObject: body)
    let (data, resp) = try await URLSession.shared.data(for: req)
    guard let http = resp as? HTTPURLResponse else { throw ApiError(message: "No response.") }
    guard http.statusCode == 200 else {
      // Supabase reports auth failures as {"error_description": ...} or {"msg": ...}
      let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
      let msg = (json?["error_description"] ?? json?["msg"]) as? String
      throw ApiError(message: msg ?? "That sign-in didn't work. Check your email and password.")
    }
    return try Self.decoder.decode(AuthSession.self, from: data)
  }

  private func validToken() async throws -> String {
    if let token = accessToken, Date() < accessExpiry { return token }
    guard let s = stored else { throw ApiError(message: "Signed out.") }
    do {
      let session = try await tokenRequest(
        grant: "refresh_token",
        body: ["refresh_token": s.refreshToken]
      )
      adopt(session)
      return session.accessToken
    } catch {
      // The refresh token was revoked (password change, deletion). Force a
      // clean sign-in rather than looping on a dead session.
      signOut()
      throw ApiError(message: "Session expired. Sign in again.")
    }
  }

  // ------------------------------------------------------------------ rest

  private func get<T: Decodable>(_ path: String, _ query: [String: String]) async throws -> T {
    let token = try await validToken()
    var comps = URLComponents(
      url: Supabase.url.appendingPathComponent("rest/v1/\(path)"),
      resolvingAgainstBaseURL: false
    )!
    comps.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
    var req = URLRequest(url: comps.url!)
    req.setValue(Supabase.anonKey, forHTTPHeaderField: "apikey")
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    let (data, resp) = try await URLSession.shared.data(for: req)
    guard (resp as? HTTPURLResponse)?.statusCode == 200 else {
      throw ApiError(message: "Couldn't load. Check your connection and try again.")
    }
    return try Self.decoder.decode(T.self, from: data)
  }

  /// Same embedded select as GAME_SELECT in mobile/lib/data.ts, minus the
  /// tracker-only columns a watch never reads.
  private static let gameSelect = """
    id,week,scheduled_date,status,home_score,away_score,is_playoff,\
    home_team_id,away_team_id,\
    home_team:teams!games_home_team_id_fkey(name,abbrev,color),\
    away_team:teams!games_away_team_id_fkey(name,abbrev,color),\
    time_slot:time_slots(label),venue:venues(name)
    """

  func myTeam() async throws -> MyTeam? {
    struct Row: Codable {
      struct Team: Codable {
        struct Season: Codable {
          struct League: Codable { let id: String; let name: String }
          let id: String
          let league: League?
        }
        let id: String
        let name: String
        let abbrev: String
        let color: String
        let season: Season?
      }
      let team: Team?
    }
    guard let uid = stored?.userId else { return nil }
    let rows: [Row] = try await get("team_members", [
      "select": "team:teams(id,name,abbrev,color,season:seasons(id,league:leagues(id,name)))",
      "user_id": "eq.\(uid)",
      "left_at": "is.null",
    ])
    guard let t = rows.compactMap({ $0.team }).first, let season = t.season,
          let league = season.league else { return nil }
    return MyTeam(
      teamId: t.id, teamName: t.name, teamAbbrev: t.abbrev, teamColor: t.color,
      seasonId: season.id, leagueId: league.id, leagueName: league.name
    )
  }

  func games(seasonId: String) async throws -> [Game] {
    try await get("games", [
      "select": Self.gameSelect,
      "season_id": "eq.\(seasonId)",
      "order": "week,scheduled_date",
    ])
  }

  func teams(seasonId: String) async throws -> [TeamLite] {
    try await get("teams", [
      "select": "id,name,abbrev,color",
      "season_id": "eq.\(seasonId)",
      "order": "created_at",
    ])
  }

  func timeSlots(leagueId: String) async throws -> [TimeSlot] {
    try await get("time_slots", [
      "select": "id,label,day_of_week,start_time,end_time",
      "league_id": "eq.\(leagueId)",
      "order": "day_of_week,start_time",
    ])
  }

  func myAvailability(seasonId: String) async throws -> [AvailabilityRow] {
    guard let uid = stored?.userId else { return [] }
    return try await get("availability", [
      "select": "time_slot_id,status",
      "season_id": "eq.\(seasonId)",
      "user_id": "eq.\(uid)",
    ])
  }

  /// Mirror of setAvailability in mobile/lib/data.ts: an upsert keyed on
  /// (user, season, slot). Throws so the caller can roll back its optimistic
  /// update — on school wifi a silent failure means the scheduler never
  /// sees you.
  func setAvailability(seasonId: String, slotId: String, status: String) async throws {
    guard let uid = stored?.userId else { throw ApiError(message: "Signed out.") }
    let token = try await validToken()
    var comps = URLComponents(
      url: Supabase.url.appendingPathComponent("rest/v1/availability"),
      resolvingAgainstBaseURL: false
    )!
    comps.queryItems = [URLQueryItem(name: "on_conflict", value: "user_id,season_id,time_slot_id")]
    var req = URLRequest(url: comps.url!)
    req.httpMethod = "POST"
    req.setValue(Supabase.anonKey, forHTTPHeaderField: "apikey")
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
    req.httpBody = try JSONSerialization.data(withJSONObject: [
      "user_id": uid, "season_id": seasonId, "time_slot_id": slotId, "status": status,
    ])
    let (_, resp) = try await URLSession.shared.data(for: req)
    let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
    guard code == 201 || code == 200 || code == 204 else {
      throw ApiError(message: "That didn't save. Check your connection and tap again.")
    }
  }
}

// ------------------------------------------------------------- pure helpers

/// W-L-diff standings from final games, regular season only. A port of the
/// core of core/standings.ts, with the same lesson applied: the comparator
/// is a TOTAL order (pct, then diff, then name by code unit) so two watches
/// — or a watch and a phone — can never disagree on rank.
func computeStandings(teams: [TeamLite], games: [Game]) -> [StandingRow] {
  struct Tally { var w = 0; var l = 0; var pf = 0; var pa = 0 }
  var tally: [String: Tally] = [:]
  for t in teams { tally[t.id] = Tally() }
  for g in games where g.isFinal && !g.isPlayoff {
    let homeWon = g.homeScore > g.awayScore
    tally[g.homeTeamId]?.w += homeWon ? 1 : 0
    tally[g.homeTeamId]?.l += homeWon ? 0 : 1
    tally[g.awayTeamId]?.w += homeWon ? 0 : 1
    tally[g.awayTeamId]?.l += homeWon ? 1 : 0
    tally[g.homeTeamId]?.pf += g.homeScore
    tally[g.homeTeamId]?.pa += g.awayScore
    tally[g.awayTeamId]?.pf += g.awayScore
    tally[g.awayTeamId]?.pa += g.homeScore
  }
  func pct(_ t: Tally) -> Double {
    let played = t.w + t.l
    return played == 0 ? 0 : Double(t.w) / Double(played)
  }
  return teams
    .map { t -> (TeamLite, Tally) in (t, tally[t.id] ?? Tally()) }
    .sorted { a, b in
      let (pa, pb) = (pct(a.1), pct(b.1))
      if pa != pb { return pa > pb }
      let (da, db) = (a.1.pf - a.1.pa, b.1.pf - b.1.pa)
      if da != db { return da > db }
      return a.0.name.utf16.lexicographicallyPrecedes(b.0.name.utf16)
    }
    .map { t, y in
      StandingRow(id: t.id, name: t.name, color: t.color, w: y.w, l: y.l, diff: y.pf - y.pa)
    }
}

/// "2026-10-08" → "Wed Oct 8", parsed as UTC so the day never slips.
/// Mirror of formatDate in mobile/components/GameCard.tsx.
func formatDate(_ d: String?) -> String {
  guard let d = d else { return "TBD" }
  let parser = DateFormatter()
  parser.locale = Locale(identifier: "en_US_POSIX")
  parser.timeZone = TimeZone(identifier: "UTC")
  parser.dateFormat = "yyyy-MM-dd"
  guard let date = parser.date(from: d) else { return "TBD" }
  let out = DateFormatter()
  out.locale = Locale(identifier: "en_US_POSIX")
  out.timeZone = TimeZone(identifier: "UTC")
  out.dateFormat = "EEE MMM d"
  return out.string(from: date)
}

/// "15:15:00" → "3:15" — a US school app has no business in 24-hour time.
func clock(_ t: String) -> String {
  let parts = t.split(separator: ":")
  guard parts.count >= 2, let h = Int(parts[0]) else { return t }
  return "\((h + 11) % 12 + 1):\(parts[1])"
}
