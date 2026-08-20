// Registering this watch for push.
//
// The three tip-off notices do not come through here and should not: those
// are scheduled locally from cached fixtures (Notifications.swift), so they
// fire in a gym with no signal. Push exists for what the watch cannot work
// out on its own — a captain approving your sub, a teammate flagging out —
// which previously waited on a background refresh watchOS granted whenever
// it felt like it.
//
// watchOS 6 and later lets a watch app hold its **own** APNs token, which is
// the only reason this is possible at all: the phone is in a drawer at home,
// so a token belonging to the phone app would be no use.
//
// The token is registered against the signed-in account, and retired on sign
// out. Registration is idempotent and cheap, so it runs on every launch
// rather than trying to remember whether it has run before — Apple can
// reissue a token after a restore, and a device quietly holding a stale one
// is exactly the bug that is impossible to notice.

import Foundation
import UserNotifications
import WatchKit

@MainActor
enum Push {
  /// Set by the delegate the moment Apple hands one over.
  private(set) static var deviceToken: String?

  /// The API this posts to. Not Supabase directly: the token has to be tied
  /// to the caller's identity, and letting the app write its own row means
  /// trusting the client with whose account it belongs to. The route does it
  /// under RLS instead.
  private static var registerURL: URL? {
    URL(string: "https://www.intramural.app/api/push/register")
  }

  /// Ask once, then tell watchOS to go get a token. Declining is fine —
  /// nothing here is the only route to any piece of information.
  static func start() {
    Task {
      let granted = (try? await UNUserNotificationCenter.current()
        .requestAuthorization(options: [.alert, .sound])) ?? false
      guard granted else { return }
      WKApplication.shared().registerForRemoteNotifications()
    }
  }

  /// Called from the delegate with Apple's raw token.
  static func adopt(_ data: Data) {
    deviceToken = data.map { String(format: "%02x", $0) }.joined()
  }

  /// Hand the token to the server, tied to whoever is signed in.
  ///
  /// Silent on failure by design: a watch that cannot register is a watch
  /// that gets its notices a little later, not a watch that should show an
  /// error over the one screen the student actually needs.
  static func register(api: Api) async {
    guard let token = deviceToken, let url = registerURL else { return }
    guard let accessToken = try? await api.validToken() else { return }

    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    req.httpBody = try? JSONSerialization.data(withJSONObject: [
      "token": token,
      "platform": "watchos",
      // The APNs topic is the *watch app's* bundle id, which is not the
      // phone's — read it rather than hard-coding, so a rename cannot leave
      // this silently pointing at an app that no longer exists.
      "bundleId": Bundle.main.bundleIdentifier ?? "",
    ])
    _ = try? await URLSession.shared.data(for: req)
  }

  /// Retire this token when the account signs out.
  ///
  /// Takes the bearer rather than the client because the caller has to
  /// capture it *before* signing out — an async refresh would be racing the
  /// session it depends on.
  ///
  /// Best-effort, and safe to lose: registration upserts on the device token
  /// itself, so the next person to sign in on this watch takes ownership of
  /// the row regardless. That upsert is the actual guarantee that nobody
  /// inherits someone else's notifications; this is just tidying up.
  static func unregister(bearer accessToken: String) async {
    guard
      let token = deviceToken,
      let base = registerURL,
      var parts = URLComponents(url: base, resolvingAgainstBaseURL: false)
    else { return }
    parts.queryItems = [URLQueryItem(name: "token", value: token)]
    guard let url = parts.url else { return }

    var req = URLRequest(url: url)
    req.httpMethod = "DELETE"
    req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    _ = try? await URLSession.shared.data(for: req)
  }
}
