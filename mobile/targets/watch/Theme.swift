// The Court preset on the wrist. Same values as the `court` branch of
// @core/theme and the web app's runtime tokens — if one changes, change all
// three. Court is the shipped default everywhere now; the cream Sideline
// preset is the alternate, and the watch does not offer it.
//
// One deliberate departure: `canvas` here is true black rather than #101218.
// A watch is an OLED panel where black pixels are off — it reads as the same
// ground, costs less battery, and makes the bezel disappear. Every card is a
// translucent overlay on top of it, exactly as on the web.

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
  /// The ground. Black on OLED; #101218 is the web equivalent.
  static let canvas = Color.black
  /// Primary text.
  static let ink = Color(hex: "#F4F5F7")
  /// The one action colour.
  static let accent = Color(hex: "#FF5C48")
  /// Type on an accent fill.
  static let onAccent = Color(hex: "#16181F")
  /// Accent, lightened, for labels sitting on the accent card.
  static let blush = Color(hex: "#FFB0A2")
  /// Secondary text.
  static let faint = Color(hex: "#7D8290")
  /// Secondary text one step brighter — captions that still need reading.
  static let muted = Color(hex: "#8A8F9C")
  /// Body text on a coloured card.
  static let dim = Color(hex: "#B7BCC7")

  /// The availability scale, and nothing else. Never chrome.
  static let positive = Color(hex: "#5BD39A")
  static let caution = Color(hex: "#FFB45C")

  // Glass. `surface` is the card fill, `rule` its hairline.
  static let surface = Color.white.opacity(0.07)
  static let surfaceStrong = Color.white.opacity(0.11)
  static let rule = Color.white.opacity(0.12)
}

extension Text {
  /// The mono eyebrow, watch-sized. JetBrains Mono isn't embedded, so the
  /// system monospaced face stands in — still "mono for anything counted",
  /// still tracked out, never emoji.
  func label() -> Text {
    self.font(.system(size: 11, weight: .medium, design: .monospaced))
      .kerning(1.2)
  }

  /// Anything counted: scores, records, clocks, jersey numbers.
  func num(_ size: CGFloat, weight: Font.Weight = .medium) -> Text {
    self.font(.system(size: size, weight: weight, design: .monospaced))
  }
}

// ------------------------------------------------------------------- pieces

/// A glass card. Everything on this app sits on one or directly on the
/// ground — flat, no shadows; a watch has no z-axis to speak of.
struct Card<Content: View>: View {
  var tinted = false
  @ViewBuilder var content: Content

  var body: some View {
    content
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(12)
      .background(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .fill(tinted ? Brand.accent.opacity(0.26) : Brand.surface)
      )
      .overlay(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .strokeBorder(tinted ? Brand.accent.opacity(0.5) : Brand.rule, lineWidth: 1)
      )
  }
}

/// The mono eyebrow that titles every screen, with an optional right-hand
/// status. Keeps the header identical across tabs without a NavigationTitle,
/// which on watchOS steals a third of a small screen.
struct Eyebrow<Trailing: View>: View {
  let text: String
  @ViewBuilder var trailing: Trailing

  var body: some View {
    HStack {
      Text(text.uppercased()).label().foregroundColor(Brand.accent)
      Spacer(minLength: 6)
      trailing
    }
  }
}

extension Eyebrow where Trailing == EmptyView {
  init(_ text: String) {
    self.init(text: text) { EmptyView() }
  }
}

/// A full-width tap target. 44pt is the phone minimum; on a wrist, in a gym,
/// mid-game, these are bigger than that on purpose.
struct BigButton: View {
  let title: String
  var style: Style = .plain
  let action: () -> Void

  enum Style { case plain, primary, danger }

  var body: some View {
    Button(action: action) {
      Text(title)
        .font(.system(size: 17, weight: .semibold))
        .frame(maxWidth: .infinity, minHeight: 46)
        .foregroundColor(fg)
    }
    .buttonStyle(.plain)
    .background(
      RoundedRectangle(cornerRadius: 22, style: .continuous).fill(bg)
    )
    .overlay(
      RoundedRectangle(cornerRadius: 22, style: .continuous)
        .strokeBorder(border, lineWidth: 1)
    )
  }

  private var fg: Color {
    switch style {
    case .primary: return Brand.onAccent
    case .danger: return Brand.blush
    case .plain: return Brand.ink
    }
  }

  private var bg: Color {
    switch style {
    case .primary: return Brand.ink
    case .danger: return Brand.accent.opacity(0.2)
    case .plain: return Brand.surface
    }
  }

  private var border: Color {
    switch style {
    case .primary: return .clear
    case .danger: return Brand.accent.opacity(0.45)
    case .plain: return Brand.rule
    }
  }
}

/// The sync line every cached screen carries, so "old data" never passes for
/// "current data" — the single most important honesty in an app built to be
/// read on a school wifi dead spot.
struct SyncLine: View {
  let syncedAt: Date?
  let online: Bool

  var body: some View {
    HStack(spacing: 6) {
      Circle()
        .fill(online ? Brand.positive : Brand.caution)
        .frame(width: 6, height: 6)
      Text(caption).font(.system(size: 12)).foregroundColor(Brand.faint)
    }
  }

  private var caption: String {
    guard let at = syncedAt else { return online ? "Syncing" : "Offline" }
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "h:mm"
    return (online ? "Synced " : "Offline · ") + f.string(from: at)
  }
}
