import SwiftUI

@main
struct IntramuralWatchApp: App {
  @StateObject private var api = Api()

  var body: some Scene {
    WindowGroup {
      NavigationStack {
        RootView()
      }
      .environmentObject(api)
    }
  }
}
