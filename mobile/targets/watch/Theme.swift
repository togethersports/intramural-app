// Brandbook v1.0 on the wrist. Same literal values as mobile/theme/index.ts
// and the web app's @theme block — if one changes, change all three.
//
// The one deliberate departure: the ground is Night Court, not Court Blue.
// A watch face is an OLED panel in a dark room; the brandbook's dark-panel
// treatment (cream text on Night Court, Whistle Red for the one action,
// blush for labels) is the variant that was designed for exactly that.

import SwiftUI

extension Color {
  /// "#RRGGBB" → Color. Team colours come out of the database in this form,
  /// so the brand constants use the same path rather than asset catalogs.
  init(hex: String) {
    var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") { s.removeFirst() }
    var v: UInt64 = 0
    Scanner(string: s).scanHexInt64(&v)
    self.init(
      .sRGB,
      red: Double((v >> 16) & 0xFF) / 255.0,
      green: Double((v >> 8) & 0xFF) / 255.0,
      blue: Double(v & 0xFF) / 255.0,
      opacity: 1.0
    )
  }
}

enum Brand {
  static let ink = Color(hex: "#17171A")      // Night Court — the ground here
  static let accent = Color(hex: "#C9242C")   // Whistle Red — the one action
  static let surface = Color(hex: "#F1EFE8")  // Sideline Cream — primary text
  static let bench = Color(hex: "#4E7CA8")    // Bench Blue — tags, secondary
  static let blush = Color(hex: "#F1A0A4")    // labels on Night Court only
  static let faint = Color(hex: "#8A8C91")
}

extension Text {
  /// The 13px mono eyebrow, watch-sized. JetBrains Mono isn't embedded in
  /// v1, so the system monospaced face stands in — still "mono for anything
  /// counted", still tracked out, never emoji.
  func label() -> Text {
    self.font(.system(size: 11, weight: .medium, design: .monospaced))
      .kerning(1.2)
  }
}
