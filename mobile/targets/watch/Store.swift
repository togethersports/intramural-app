// What the watch knows, and how old it is.
//
// The design constraint that shapes this whole file: a school gym is a wifi
// dead spot, and the watch is the only device the student has. So nothing
// here ever shows a spinner where it could show yesterday's answer instead.
// Every screen renders from disk first and reconciles afterwards, and every
// screen says when it last managed to reach the server — because cached data
// presented as current is the one failure mode that actually strands someone
// in the wrong gym.

import Foundation
import SwiftUI

// -------------------------------------------------------------------- cache

/// A tiny Codable-to-disk cache. Not the keychain: none of this is secret,
/// and the keychain is the wrong tool for a few kilobytes of fixtures.
enum Cache {
  private static var dir: URL {
    let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    let d = base.appendingPathComponent("intramural", isDirectory: true)
    try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
    return d
  }

  private struct Envelope<T: Codable>: Codable {
    let at: Date
    let value: T
  }

  static func save<T: Codable>(_ value: T, key: String) {
    let url = dir.appendingPathComponent("\(key).json")
    guard let data = try? JSONEncoder().encode(Envelope(at: Date(), value: value)) else { return }
    try? data.write(to: url, options: .atomic)
  }

  static func load<T: Codable>(_ type: T.Type, key: String) -> (value: T, at: Date)? {
    let url = dir.appendingPathComponent("\(key).json")
    guard let data = try? Data(contentsOf: url),
          let env = try? JSONDecoder().decode(Envelope<T>.self, from: data)
    else { return nil }
    return (env.value, env.at)
  }

  static func clear() {
    try? FileManager.default.removeItem(at: dir)
  }
}

// -------------------------------------------------------------------- store

/// One source of truth for every screen. Views read it and never fetch.
@MainActor
final class Store: ObservableObject {
  @Published var team: MyTeam?
  @Published var games: [Game] = []
  @Published var teams: [TeamLite] = []
  @Published var polls: [SchedulePoll] = []
  @Published var pollVotes: [PollVote] = []
  @Published var subs: [SubRequest] = []
  @Published var absentFrom: Set<String> = []

  /// When the server was last reached. Nil means never — first launch with
  /// no signal, the only state where a screen genuinely has nothing to say.
  @Published var syncedAt: Date?
  @Published var online = true
  @Published var loading = false
  /// Set only when there is nothing cached to fall back on. A refresh that
  /// fails while yesterday's fixtures are on screen is not an error the
  /// student can act on, so it does not become one.
  @Published var fatal: String?

  private let api: Api
  init(api: Api) {
    self.api = api
    hydrate()
  }

  var standings: [StandingRow] { computeStandings(teams: teams, games: games) }

  /// Today's games for my team, in the order they'll be played.
  var todaysGames: [Game] {
    let today = isoToday()
    guard let mine = team?.teamId else { return [] }
    return games.filter {
      $0.scheduledDate == today && ($0.homeTeamId == mine || $0.awayTeamId == mine)
    }
  }

  /// The one the Today screen leads with: the next unplayed game today, or
  /// failing that the most recent result, or failing that the next fixture
  /// at all. A student looking at their wrist at 8am and at 2pm should both
  /// see the thing that matters to them right then.
  var headline: Game? {
    todaysGames.first(where: { $0.isUpcoming })
      ?? todaysGames.last
      ?? games.first(where: { $0.isUpcoming && involvesMe($0) })
  }

  func involvesMe(_ g: Game) -> Bool {
    guard let mine = team?.teamId else { return false }
    return g.homeTeamId == mine || g.awayTeamId == mine
  }

  func opponent(of g: Game) -> String {
    guard let mine = team?.teamId else { return "TBD" }
    let other = g.homeTeamId == mine ? g.awayTeam : g.homeTeam
    return other?.name ?? "TBD"
  }

  // --------------------------------------------------------------- loading

  /// Disk first, synchronously, before a single byte moves. This is what
  /// makes the app readable the instant it opens in a basement gym.
  private func hydrate() {
    if let c = Cache.load(MyTeam.self, key: "team") { team = c.value; syncedAt = c.at }
    if let c = Cache.load([Game].self, key: "games") { games = c.value; syncedAt = c.at }
    if let c = Cache.load([TeamLite].self, key: "teams") { teams = c.value }
  }

  func refresh() async {
    loading = true
    defer { loading = false }
    do {
      guard let t = try await api.myTeam() else {
        team = nil
        online = true
        syncedAt = Date()
        return
      }
      team = t
      Cache.save(t, key: "team")

      async let gamesTask = api.games(seasonId: t.seasonId)
      async let teamsTask = api.teams(seasonId: t.seasonId)
      let (g, tt) = try await (gamesTask, teamsTask)
      games = g
      teams = tt
      Cache.save(g, key: "games")
      Cache.save(tt, key: "teams")

      online = true
      syncedAt = Date()
      fatal = nil

      // Best-effort. A season with no open poll is the normal case, and a
      // failure here must not cost the student their schedule.
      await refreshSeasonExtras(seasonId: t.seasonId)
      await Notifier.shared.reschedule(from: self)
    } catch {
      online = false
      // Only surface the error if there is nothing to show behind it.
      if games.isEmpty && team == nil {
        fatal = error.localizedDescription
      }
    }
  }

  func refreshSeasonExtras(seasonId: String) async {
    let fetched = try? await api.openPolls(seasonId: seasonId)
    if let p = fetched {
      polls = p
      let ids = p.flatMap { $0.options.map(\.id) }
      pollVotes = (try? await api.pollVotes(optionIds: ids)) ?? []
    }
    let ids = todaysGames.map(\.id)
    subs = (try? await api.subRequests(gameIds: ids)) ?? []
    absentFrom = (try? await api.myAbsences(gameIds: ids)) ?? absentFrom
  }

  /// Requests this user is the one being asked about — the notification and
  /// the badge both key off this.
  var decisionsForMe: [SubRequest] {
    subs.filter { $0.needsDecision }
  }

  func signOutAndForget() {
    Cache.clear()
    Notifier.shared.cancelAll()
    // Capture the bearer before dropping it: retiring the push token is an
    // authenticated call, and signing out first would leave it unable to
    // authenticate. Sign-out itself stays synchronous so the UI switches to
    // the login screen on the tap rather than a network round trip later.
    let bearer = api.currentAccessToken
    api.signOut()
    if let bearer { Task { await Push.unregister(bearer: bearer) } }
  }
}

// ------------------------------------------------------------------- clock

/// Today in the league's terms. `games.scheduled_date` is a bare date, so
/// this compares like with like — no timezone, no drift at midnight.
func isoToday() -> String {
  let f = DateFormatter()
  f.locale = Locale(identifier: "en_US_POSIX")
  f.dateFormat = "yyyy-MM-dd"
  return f.string(from: Date())
}

/// "In 58 min", "In 3 hr", "Now", "Done". The Today card's whole job is
/// answering "do I need to move yet", so it counts down rather than stating
/// a clock time the reader then has to subtract from.
func countdown(to date: Date?, now: Date = Date()) -> String? {
  guard let date = date else { return nil }
  let mins = Int(date.timeIntervalSince(now) / 60)
  if mins < -120 { return nil }
  if mins < 0 { return "Now" }
  if mins == 0 { return "Now" }
  if mins < 60 { return "In \(mins) min" }
  let hrs = mins / 60
  if hrs < 24 { return "In \(hrs) hr" }
  return nil
}

/// A game's start, as a real instant, from its date plus its slot's start
/// time. Local time on purpose: the slot is a school period, and a school
/// period is a wall-clock fact in the building the watch is standing in.
func startInstant(dateISO: String?, startTime: String?) -> Date? {
  guard let d = dateISO else { return nil }
  let f = DateFormatter()
  f.locale = Locale(identifier: "en_US_POSIX")
  f.dateFormat = "yyyy-MM-dd HH:mm:ss"
  let t = startTime ?? "15:00:00"
  let padded = t.count == 5 ? t + ":00" : t
  return f.date(from: "\(d) \(padded)")
}
