import SwiftUI

@main
struct IntramuralWatchApp: App {
  @StateObject private var api = Api()

  // No NavigationStack here: each tab page owns its own (the watchOS
  // pattern — a stack nested inside another stack misbehaves at runtime).
  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(api)
    }
  }
}
