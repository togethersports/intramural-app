import SwiftUI
import WatchKit

@main
struct IntramuralWatchApp: App {
  @StateObject private var api = Api()

  // The delegate exists for one job: keeping the periodic background wake
  // alive so a sub waiting on this student's approval can reach their wrist
  // without a push server. See Notifications.swift for why that's local.
  @WKApplicationDelegateAdaptor(RefreshDelegate.self) private var delegate

  // No NavigationStack here: each tab page owns its own (the watchOS
  // pattern — a stack nested inside another stack misbehaves at runtime).
  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(api)
    }
  }
}
