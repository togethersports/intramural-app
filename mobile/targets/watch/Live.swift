// The live game: reading one, and keeping one.
//
// Score is derived by replaying `game_events`, not read from
// `games.home_score`. That is the same choice the web console and the recap
// writer make, and it is the reason a watch, a phone and a laptop watching
// the same game always show the same number: the event log is the fact, the
// column is a cache of it. A port of withRunningScore + SCORING_POINTS in
// @core/live and @core/game-constants — if those change, change this.

import Foundation

// -------------------------------------------------------------------- model

struct LiveEvent: Codable, Identifiable {
  let id: String
  let seq: Int
  let period: Int
  let teamId: String?
  let userId: String?
  let type: String
  let voided: Bool
}

/// A player the scorekeeper can tap. `number` is the jersey, which is what
/// anyone courtside actually calls them by.
struct RosterPlayer: Codable, Identifiable {
  let id: String        // team_members.id
  let userId: String
  let name: String
  let number: Int?
  let starter: Bool
}

/// Everything the two live screens need, computed once.
struct LiveState {
  var home = 0
  var away = 0
  var period = 1
  /// The signed-in player's own line, if they are in this game.
  var myPoints = 0
  var myRebounds = 0
  var myAssists = 0
  var myFouls = 0
}

/// Points per event type. Mirrors SCORING_POINTS.
let scoringPoints: [String: Int] = ["fg2_made": 2, "fg3_made": 3, "ft_made": 1]

/// Replay the log. Voided events are skipped — an undo writes `voided`
/// rather than deleting, so the log stays append-only and two devices can
/// never disagree about what happened.
func replay(_ events: [LiveEvent], homeTeamId: String, me: String?) -> LiveState {
  var s = LiveState()
  for e in events.sorted(by: { $0.seq < $1.seq }) where !e.voided {
    if let pts = scoringPoints[e.type], let team = e.teamId {
      if team == homeTeamId { s.home += pts } else { s.away += pts }
    }
    if e.period > s.period { s.period = e.period }
    guard let me = me, e.userId == me else { continue }
    switch e.type {
    case "fg2_made": s.myPoints += 2
    case "fg3_made": s.myPoints += 3
    case "ft_made": s.myPoints += 1
    case "oreb", "dreb": s.myRebounds += 1
    case "ast": s.myAssists += 1
    case "pf", "tf": s.myFouls += 1
    default: break
    }
  }
  return s
}

/// The six things a scorekeeper can log from a wrist. Deliberately not the
/// full nineteen the web console offers: a miss, a steal, a block and a
/// turnover are all things you can reconstruct afterwards, and none of them
/// is worth a mis-tap during a fast break. Points, boards, assists, fouls.
struct StatButton: Identifiable {
  let id: String        // the game_events.type
  let title: String
  let caption: String?
}

let watchStats: [StatButton] = [
  StatButton(id: "fg2_made", title: "+2", caption: "PTS"),
  StatButton(id: "fg3_made", title: "+3", caption: "PTS"),
  StatButton(id: "ft_made", title: "+1", caption: "FT"),
  StatButton(id: "dreb", title: "REB", caption: nil),
  StatButton(id: "ast", title: "AST", caption: nil),
  StatButton(id: "pf", title: "FOUL", caption: nil),
]

// ---------------------------------------------------------------------- api

extension Api {
  func liveEvents(gameId: String) async throws -> [LiveEvent] {
    try await get("game_events", [
      "select": "id,seq,period,team_id,user_id,type,voided",
      "game_id": "eq.\(gameId)",
      "order": "seq",
    ])
  }

  func roster(teamId: String) async throws -> [RosterPlayer] {
    struct Row: Codable {
      struct Profile: Codable { let fullName: String? }
      let id: String
      let userId: String
      let jerseyNumber: Int?
      let lineupRole: String?
      let profile: Profile?
    }
    let rows: [Row] = try await get("team_members", [
      "select": "id,user_id,jersey_number,lineup_role,profile:profiles(full_name)",
      "team_id": "eq.\(teamId)",
      "left_at": "is.null",
      "order": "lineup_order,jersey_number",
    ])
    return rows.map {
      RosterPlayer(
        id: $0.id,
        userId: $0.userId,
        // Surname alone: "Diaz" fits a 44mm button, "Gabriel Diaz" does not.
        name: surname($0.profile?.fullName ?? "Unnamed"),
        number: $0.jerseyNumber,
        starter: $0.lineupRole == "starter"
      )
    }
  }

  /// Append one event. The sequence number and client uuid are minted here
  /// for the same reason the phone tracker mints them: the row must be
  /// idempotent under a retry on bad gym wifi, and `client_uuid` is what
  /// makes a duplicate POST land on the same row instead of scoring twice.
  ///
  /// Returns the client uuid so the caller can void it during the undo
  /// window without waiting for the insert's response to come back.
  @discardableResult
  func logStat(
    gameId: String,
    teamId: String,
    userId: String,
    type: String,
    period: Int,
    afterSeq: Int
  ) async throws -> String {
    guard let me = stored?.userId else { throw ApiError(message: "Signed out.") }
    let clientUuid = UUID().uuidString.lowercased()
    try await write(
      "game_events",
      [
        "game_id": gameId,
        "seq": afterSeq + 1,
        "period": period,
        "team_id": teamId,
        "user_id": userId,
        "type": type,
        "created_by": me,
        "client_uuid": clientUuid,
      ],
      onConflict: "game_id,client_uuid",
      failure: "That stat didn't save. Tap it again."
    )
    return clientUuid
  }

  /// Undo. Voids rather than deletes, so the log stays append-only and the
  /// running score recomputes to the same number everywhere.
  func voidStat(gameId: String, clientUuid: String) async throws {
    let token = try await validToken()
    var comps = URLComponents(
      url: Supabase.url.appendingPathComponent("rest/v1/game_events"),
      resolvingAgainstBaseURL: false
    )!
    comps.queryItems = [
      URLQueryItem(name: "game_id", value: "eq.\(gameId)"),
      URLQueryItem(name: "client_uuid", value: "eq.\(clientUuid)"),
    ]
    var req = URLRequest(url: comps.url!)
    req.httpMethod = "PATCH"
    req.setValue(Supabase.anonKey, forHTTPHeaderField: "apikey")
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
    req.httpBody = try JSONSerialization.data(withJSONObject: ["voided": true])
    let (_, resp) = try await URLSession.shared.data(for: req)
    let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
    guard code == 200 || code == 204 else {
      throw ApiError(message: "Couldn't undo that. It stays on the sheet.")
    }
  }

  /// Whether this user may keep stats for this game. Scorekeeper or league
  /// admin — the same two the console checks. RLS refuses the write either
  /// way; this only decides whether to offer the button.
  func canScore(gameId: String, leagueId: String) async throws -> Bool {
    guard let uid = stored?.userId else { return false }
    struct GameRow: Codable { let scorekeeperId: String? }
    let games: [GameRow] = try await get("games", [
      "select": "scorekeeper_id", "id": "eq.\(gameId)",
    ])
    if games.first?.scorekeeperId == uid { return true }
    struct MemberRow: Codable { let role: String }
    let members: [MemberRow] = try await get("league_members", [
      "select": "role",
      "league_id": "eq.\(leagueId)",
      "user_id": "eq.\(uid)",
      "status": "eq.active",
    ])
    guard let role = members.first?.role else { return false }
    return role == "commissioner" || role == "admin"
  }
}

/// "Gabriel Diaz" → "Diaz". One word in, one word out.
func surname(_ full: String) -> String {
  let parts = full.split(separator: " ")
  return parts.count > 1 ? String(parts[parts.count - 1]) : full
}
