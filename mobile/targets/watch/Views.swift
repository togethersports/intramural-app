// Player-first, wrist-sized. The four things a player checks between classes:
// when do I play, what's the schedule, where do we stand, am I in or out.
// Commissioner surfaces stay on the web; the tracker stays on the phone.

import SwiftUI

private let DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// --------------------------------------------------------------------- root

struct RootView: View {
  @EnvironmentObject var api: Api

  var body: some View {
    if api.isSignedIn {
      MainView()
    } else {
      SignInView()
    }
  }
}

// ------------------------------------------------------------------ sign in

struct SignInView: View {
  @EnvironmentObject var api: Api
  @State private var email = ""
  @State private var password = ""
  @State private var busy = false
  @State private var error: String?

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        Text("INTRAMURAL").label().foregroundColor(Brand.blush)
        Text("Sign in with the account from the phone app.")
          .font(.footnote).foregroundColor(Brand.faint)
        TextField("Email", text: $email)
          .textContentType(.username)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled(true)
        SecureField("Password", text: $password)
          .textContentType(.password)
        if let error = error {
          Text(error).font(.footnote).foregroundColor(Brand.accent)
        }
        Button {
          Task { await submit() }
        } label: {
          if busy { ProgressView() } else { Text("Sign in") }
        }
        .tint(Brand.accent)
        .buttonStyle(.borderedProminent)
        .disabled(busy || email.isEmpty || password.isEmpty)
      }
    }
  }

  private func submit() async {
    busy = true
    error = nil
    do {
      try await api.signIn(email: email, password: password)
    } catch {
      self.error = error.localizedDescription
    }
    busy = false
  }
}

// --------------------------------------------------------------------- main

struct MainView: View {
  @EnvironmentObject var api: Api
  @State private var team: MyTeam?
  @State private var games: [Game] = []
  @State private var teams: [TeamLite] = []
  @State private var loaded = false
  @State private var error: String?

  var body: some View {
    Group {
      if !loaded {
        ProgressView()
      } else if let error = error {
        VStack(spacing: 8) {
          Text(error).font(.footnote).multilineTextAlignment(.center)
          Button("Retry") { Task { await load() } }.tint(Brand.accent)
        }
      } else if let team = team {
        TabView {
          HomeView(team: team, games: games)
          ScheduleView(games: games)
          StandingsView(teams: teams, games: games, myTeamId: team.teamId)
          AvailabilityView(team: team)
          SettingsView(team: team, reload: { Task { await load() } })
        }
      } else {
        VStack(spacing: 8) {
          Text("No team yet")
            .font(.headline)
          Text("Join a league in the phone app first — teams are drafted there.")
            .font(.footnote).foregroundColor(Brand.faint)
            .multilineTextAlignment(.center)
          Button("Reload") { Task { await load() } }.tint(Brand.accent)
          Button("Sign out") { api.signOut() }
        }
      }
    }
    .task { await load() }
  }

  private func load() async {
    loaded = false
    error = nil
    do {
      let t = try await api.myTeam()
      team = t
      if let t = t {
        async let g = api.games(seasonId: t.seasonId)
        async let tt = api.teams(seasonId: t.seasonId)
        games = try await g
        teams = try await tt
      }
    } catch {
      self.error = error.localizedDescription
    }
    loaded = true
  }
}

// --------------------------------------------------------------------- home

struct HomeView: View {
  let team: MyTeam
  let games: [Game]

  private var next: Game? {
    games.first {
      $0.isUpcoming && ($0.homeTeamId == team.teamId || $0.awayTeamId == team.teamId)
    }
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 6) {
        Text("NEXT GAME").label().foregroundColor(Brand.blush)
        if let g = next {
          let home = g.homeTeamId == team.teamId
          let opponent = home ? g.awayTeam : g.homeTeam
          if g.status == "live" {
            HStack(spacing: 5) {
              Circle().fill(Brand.accent).frame(width: 7, height: 7)
              Text("LIVE").label().foregroundColor(Brand.accent)
            }
            Text("\(home ? g.homeScore : g.awayScore) — \(home ? g.awayScore : g.homeScore)")
              .font(.system(size: 34, weight: .semibold))
              .monospacedDigit()
          }
          Text("vs \(opponent?.name ?? "TBD")")
            .font(.headline)
          Text(formatDate(g.scheduledDate))
            .font(.body).foregroundColor(Brand.surface)
          if let slot = g.timeSlot?.label {
            Text(slot).font(.footnote).foregroundColor(Brand.bench)
          }
          if let venue = g.venue?.name {
            Text(venue).font(.footnote).foregroundColor(Brand.faint)
          }
        } else {
          Text("Nothing scheduled")
            .font(.headline)
          Text("Games appear once your commissioner builds the schedule.")
            .font(.footnote).foregroundColor(Brand.faint)
        }
        Divider().padding(.vertical, 4)
        Text(team.teamName).font(.footnote).foregroundColor(Brand.faint)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .navigationTitle("Home")
  }
}

// ----------------------------------------------------------------- schedule

struct ScheduleView: View {
  let games: [Game]

  var body: some View {
    List {
      if games.isEmpty {
        Text("No games scheduled").font(.footnote).foregroundColor(Brand.faint)
      }
      ForEach(games) { g in
        VStack(alignment: .leading, spacing: 2) {
          Text("WK \(g.week) · \(formatDate(g.scheduledDate))")
            .label().foregroundColor(Brand.blush)
          HStack {
            Text(g.homeTeam?.abbrev ?? "?")
              .font(.body)
            Spacer()
            if g.isFinal || g.status == "live" {
              Text("\(g.homeScore)").monospacedDigit()
            }
          }
          HStack {
            Text(g.awayTeam?.abbrev ?? "?")
              .font(.body)
            Spacer()
            if g.isFinal || g.status == "live" {
              Text("\(g.awayScore)").monospacedDigit()
            }
          }
          if g.status == "live" {
            Text("LIVE").label().foregroundColor(Brand.accent)
          }
        }
        .padding(.vertical, 2)
      }
    }
    .navigationTitle("Schedule")
  }
}

// ---------------------------------------------------------------- standings

struct StandingsView: View {
  let teams: [TeamLite]
  let games: [Game]
  let myTeamId: String

  var body: some View {
    List {
      ForEach(Array(computeStandings(teams: teams, games: games).enumerated()), id: \.element.id) { i, row in
        HStack(spacing: 6) {
          Text("\(i + 1)")
            .font(.footnote).monospacedDigit().foregroundColor(Brand.faint)
            .frame(width: 16, alignment: .trailing)
          Circle().fill(Color(hex: row.color)).frame(width: 8, height: 8)
          Text(row.name)
            .font(.footnote)
            .fontWeight(row.id == myTeamId ? .semibold : .regular)
            .lineLimit(1)
          Spacer()
          Text("\(row.w)-\(row.l)")
            .font(.footnote).monospacedDigit()
        }
      }
    }
    .navigationTitle("Standings")
  }
}

// -------------------------------------------------------------- availability

struct AvailabilityView: View {
  @EnvironmentObject var api: Api
  let team: MyTeam
  @State private var slots: [TimeSlot] = []
  @State private var picked: [String: String] = [:]
  @State private var loaded = false
  @State private var error: String?

  var body: some View {
    NavigationStack {
      List {
        if let error = error {
          Text(error).font(.footnote).foregroundColor(Brand.accent)
        }
        if loaded && slots.isEmpty {
          Text("Your commissioner hasn't defined time slots yet.")
            .font(.footnote).foregroundColor(Brand.faint)
        }
        ForEach(slots) { slot in
          NavigationLink {
            SlotPicker(slot: slot, current: picked[slot.id]) { status in
              await choose(slot: slot, status: status)
            }
          } label: {
            VStack(alignment: .leading, spacing: 2) {
              Text(slot.label).font(.footnote)
              Text("\(DAYS[slot.dayOfWeek]) · \(clock(slot.startTime))–\(clock(slot.endTime))")
                .font(.footnote).foregroundColor(Brand.faint)
            }
            .badge(badgeText(picked[slot.id]))
          }
        }
      }
      .navigationTitle("Availability")
    }
    .task {
      guard !loaded else { return }
      do {
        slots = try await api.timeSlots(leagueId: team.leagueId)
        let mine = try await api.myAvailability(seasonId: team.seasonId)
        picked = Dictionary(uniqueKeysWithValues: mine.map { ($0.timeSlotId, $0.status) })
      } catch {
        self.error = error.localizedDescription
      }
      loaded = true
    }
  }

  private func badgeText(_ status: String?) -> String {
    switch status {
    case "yes": return "In"
    case "maybe": return "Maybe"
    case "no": return "Out"
    default: return ""
    }
  }

  /// Optimistic, and it ROLLS BACK on failure — same contract as the phone.
  private func choose(slot: TimeSlot, status: String) async {
    let prev = picked[slot.id]
    picked[slot.id] = status
    error = nil
    do {
      try await api.setAvailability(seasonId: team.seasonId, slotId: slot.id, status: status)
    } catch {
      picked[slot.id] = prev
      self.error = error.localizedDescription
    }
  }
}

struct SlotPicker: View {
  @Environment(\.dismiss) private var dismiss
  let slot: TimeSlot
  let current: String?
  let choose: (String) async -> Void

  var body: some View {
    ScrollView {
      VStack(spacing: 6) {
        Text(slot.label).font(.footnote).foregroundColor(Brand.faint)
        option("In", "yes", tint: Brand.surface)
        option("Maybe", "maybe", tint: Brand.bench)
        option("Out", "no", tint: Brand.accent)
      }
    }
  }

  private func option(_ title: String, _ value: String, tint: Color) -> some View {
    Button {
      Task {
        await choose(value)
        dismiss()
      }
    } label: {
      HStack {
        Text(title)
        if current == value { Spacer(); Text("·").bold() }
      }
    }
    .tint(tint)
  }
}

// ----------------------------------------------------------------- settings

struct SettingsView: View {
  @EnvironmentObject var api: Api
  let team: MyTeam
  let reload: () -> Void

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        Text("LEAGUE").label().foregroundColor(Brand.blush)
        Text(team.leagueName).font(.footnote)
        Text(api.stored?.email ?? "").font(.footnote).foregroundColor(Brand.faint)
        Button("Reload") { reload() }
        Button("Sign out", role: .destructive) { api.signOut() }
          .tint(Brand.accent)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .navigationTitle("Me")
  }
}
