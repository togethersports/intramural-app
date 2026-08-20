// Notifications, without a push server.
//
// The obvious design is APNs: the reminder cron already knows who to tell and
// when, so it could just push. But this project has no APNs setup — no key,
// no device-token table, no certificate — and adding one is a much larger
// change than the watch app itself. More to the point, a pushed alert has to
// travel phone → watch, and the entire premise here is that the phone is at
// home in a drawer.
//
// So the three tip-off notices are scheduled **on the watch**, from the
// fixtures it already caches, using the same offsets as
// @core/reminders: 7:15am the morning of, an hour out, ten minutes out. They
// fire with the watch in airplane mode in a basement gym, which is exactly
// where they are needed and exactly where a push would not arrive.
//
// The limitation this leaves is real and worth naming: anything the *server*
// learns that the watch cannot derive — a captain approving your sub, a
// teammate dropping out — cannot interrupt the student. Background refresh
// narrows the gap (watchOS wakes the app periodically, we poll, and raise a
// local notice if something is waiting), but watchOS decides when that runs
// and it is minutes-to-hours, not seconds. Genuinely instant alerts need
// APNs; that is a backend change, tracked in WATCH.md.

import Foundation
import UserNotifications
#if os(watchOS)
  import WatchKit
#endif

@MainActor
final class Notifier {
  static let shared = Notifier()
  private init() {}

  private let center = UNUserNotificationCenter.current()

  /// Asked for once, at first launch of the signed-in app. Declining is
  /// fine — every notice here is also visible on the Today screen.
  func requestAuthorization() async {
    _ = try? await center.requestAuthorization(options: [.alert, .sound])
  }

  // ------------------------------------------------------------ tip-offs

  /// Rebuild the whole schedule of local notices from what the store knows.
  ///
  /// Wholesale replacement rather than diffing: identifiers are derived from
  /// (game, kind), so re-registering the same game overwrites rather than
  /// duplicates, and a game that moved or was cancelled simply stops being
  /// re-registered. Diffing would be the bug farm here, and there are at
  /// most a few dozen pending requests.
  func reschedule(from store: Store) async {
    let pending = await center.pendingNotificationRequests()
    let mine = pending.map(\.identifier).filter { $0.hasPrefix("tip.") }
    center.removePendingNotificationRequests(withIdentifiers: mine)

    let now = Date()
    for game in store.games where game.isUpcoming && store.involvesMe(game) {
      guard let start = startInstant(
        dateISO: game.scheduledDate,
        startTime: game.timeSlot?.startTime
      ) else { continue }
      // A fixture three weeks out would burn one of the 64 pending slots
      // watchOS allows for no benefit; it gets scheduled when it's close.
      guard start.timeIntervalSince(now) < 60 * 60 * 36 else { continue }

      let opponent = store.opponent(of: game)
      let place = game.venue?.name ?? "TBD"
      let slot = game.timeSlot?.label

      for kind in ReminderKind.allCases {
        guard let fireAt = kind.fireDate(gameStart: start), fireAt > now else { continue }
        await add(
          id: "tip.\(game.id).\(kind.rawValue)",
          title: kind.title,
          body: kind.body(opponent: opponent, place: place, slot: slot, start: start),
          at: fireAt
        )
      }
    }
  }

  /// The same three moments the email and text reminders use. Kept as one
  /// enum so "when do we tell people" is a single list, not three literals
  /// scattered through a scheduling loop.
  enum ReminderKind: String, CaseIterable {
    case morning, hour, ten

    /// 7:15am local on the day of the game.
    func fireDate(gameStart: Date) -> Date? {
      switch self {
      case .morning:
        var c = Calendar.current.dateComponents([.year, .month, .day], from: gameStart)
        c.hour = 7
        c.minute = 15
        return Calendar.current.date(from: c)
      case .hour:
        return gameStart.addingTimeInterval(-60 * 60)
      case .ten:
        return gameStart.addingTimeInterval(-10 * 60)
      }
    }

    var title: String {
      switch self {
      case .morning: return "Game today"
      case .hour: return "Game in an hour"
      case .ten: return "Tip-off in 10 min"
      }
    }

    func body(opponent: String, place: String, slot: String?, start: Date) -> String {
      let f = DateFormatter()
      f.locale = Locale(identifier: "en_US_POSIX")
      f.dateFormat = "h:mm"
      let when = slot.map { "\(f.string(from: start)) · \($0)" } ?? f.string(from: start)
      switch self {
      case .morning: return "vs \(opponent) at \(when), \(place)."
      case .hour: return "vs \(opponent) at \(when), \(place)."
      case .ten: return "vs \(opponent) · \(place). Head down now."
      }
    }
  }

  // -------------------------------------------------------------- alerts

  /// Something the server knows and the watch just found out. Fires
  /// immediately — it is already late by definition, having waited for a
  /// background refresh.
  func alert(id: String, title: String, body: String) async {
    await add(id: id, title: title, body: body, at: Date().addingTimeInterval(1))
  }

  private func add(id: String, title: String, body: String, at date: Date) async {
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = .default
    let comps = Calendar.current.dateComponents(
      [.year, .month, .day, .hour, .minute, .second], from: date
    )
    let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
    let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
    try? await center.add(request)
  }

  func cancelAll() {
    center.removeAllPendingNotificationRequests()
  }
}

// -------------------------------------------------------- background wake

#if os(watchOS)

  /// Polls for the things the watch cannot derive on its own — a sub request
  /// waiting on this user's decision — and raises a local notice for them.
  ///
  /// watchOS grants these sparingly and on its own schedule. Treat it as
  /// "within the hour", never "within the minute"; the Today screen is the
  /// reliable surface and this is the courtesy tap on the wrist.
  final class RefreshDelegate: NSObject, WKApplicationDelegate {
    /// Set by the app so the background task can reach the same store the UI
    /// is showing, instead of building a second one that disagrees with it.
    static var store: Store?

    func applicationDidFinishLaunching() {
      scheduleNextRefresh()
    }

    func handle(_ backgroundTasks: Set<WKRefreshBackgroundTask>) {
      for task in backgroundTasks {
        guard let refresh = task as? WKApplicationRefreshBackgroundTask else {
          task.setTaskCompletedWithSnapshot(false)
          continue
        }
        Task { @MainActor in
          await Self.pollForDecisions()
          scheduleNextRefresh()
          refresh.setTaskCompletedWithSnapshot(false)
        }
      }
    }

    @MainActor
    private static func pollForDecisions() async {
      guard let store = store, let team = store.team else { return }
      let before = Set(store.decisionsForMe.map(\.id))
      await store.refreshSeasonExtras(seasonId: team.seasonId)
      for request in store.decisionsForMe where !before.contains(request.id) {
        let who = request.fillName ?? "Someone"
        await Notifier.shared.alert(
          id: "sub.\(request.id)",
          title: "A sub needs approving",
          body: "\(who) is offered for \(request.absentName). Open to approve."
        )
      }
    }

    private func scheduleNextRefresh() {
      WKApplication.shared().scheduleBackgroundRefresh(
        withPreferredDate: Date().addingTimeInterval(30 * 60),
        userInfo: nil
      ) { _ in }
    }
  }

#endif
