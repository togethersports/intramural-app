// The school-day device.
//
// The premise: phones are off between 8 and 4, so for those eight hours the
// watch is not a companion to the app — it *is* the app. That changes what
// belongs here. v1 was four read-only screens; this adds the things a student
// actually has to *do* during the day, and each one resolves in one or two
// taps because the alternative is doing it under a desk in fourth period.
//
// What stays off the wrist, per the brief's surface rules: the draft, full
// box-score entry, recap prose, and anything that needs typing.

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
        Text("INTRAMURAL").label().foregroundColor(Brand.accent)
        Text("Sign in once. The watch stays signed in on its own after that.")
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
  @StateObject private var store: StoreBox = StoreBox()

  var body: some View {
    Group {
      if let store = store.value {
        content(store)
          .environmentObject(store)
      } else {
        ProgressView()
      }
    }
    .task {
      store.make(api: api)
      guard let s = store.value else { return }
      RefreshDelegate.store = s
      RefreshDelegate.api = api
      await Notifier.shared.requestAuthorization()
      // If Apple already handed a token over before sign-in finished, this
      // is the moment it can finally be tied to an account.
      await Push.register(api: api)
      await s.refresh()
    }
  }

  @ViewBuilder
  private func content(_ store: Store) -> some View {
    // A fatal is only ever set when there is nothing cached behind it, so
    // this branch means a genuinely empty first launch, not a flaky gym.
    if let fatal = store.fatal {
      ScrollView {
        VStack(spacing: 8) {
          Text(fatal).font(.footnote).multilineTextAlignment(.center)
          BigButton(title: "Retry") { Task { await store.refresh() } }
        }
      }
    } else if store.team == nil && !store.loading {
      ScrollView {
        VStack(spacing: 8) {
          Text("No team yet").font(.headline)
          Text("Join a league in the phone app — teams are drafted there.")
            .font(.footnote).foregroundColor(Brand.faint)
            .multilineTextAlignment(.center)
          BigButton(title: "Reload") { Task { await store.refresh() } }
          BigButton(title: "Sign out") { store.signOutAndForget() }
        }
      }
    } else {
      TabView {
        TodayView()
        StandingsView()
        PollsView()
        if let team = store.team { AvailabilityView(team: team) }
        SettingsView()
      }
    }
  }
}

/// `@StateObject` needs its object at init, but Store needs the Api that only
/// arrives from the environment. This box defers construction by one tick
/// without letting the store be rebuilt on every redraw.
@MainActor
final class StoreBox: ObservableObject {
  @Published var value: Store?
  func make(api: Api) {
    guard value == nil else { return }
    value = Store(api: api)
  }
}

// -------------------------------------------------------------------- today

struct TodayView: View {
  @EnvironmentObject var store: Store

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 8) {
          Eyebrow(text: "Today") {
            if store.loading {
              ProgressView().scaleEffect(0.6)
            } else {
              Text(nowClock()).num(14).foregroundColor(Brand.ink)
            }
          }

          if let game = store.headline {
            GameHero(game: game)
            if !store.decisionsForMe.isEmpty {
              NavigationLink { SubApprovalsView() } label: {
                Card(tinted: true) {
                  VStack(alignment: .leading, spacing: 2) {
                    Text("NEEDS YOU").label().foregroundColor(Brand.blush)
                    Text("\(store.decisionsForMe.count) sub to approve")
                      .font(.system(size: 15, weight: .semibold))
                  }
                }
              }
              .buttonStyle(.plain)
            }
            actions(for: game)
          } else {
            Card {
              VStack(alignment: .leading, spacing: 4) {
                Text("Nothing today").font(.system(size: 17, weight: .semibold))
                Text("Your next game will show up here the morning it's on.")
                  .font(.footnote).foregroundColor(Brand.faint)
              }
            }
          }

          SyncLine(syncedAt: store.syncedAt, online: store.online)
            .padding(.top, 2)
        }
        .padding(.horizontal, 2)
      }
    }
  }

  @ViewBuilder
  private func actions(for game: Game) -> some View {
    if game.status == "live" {
      NavigationLink { LiveGameView(game: game) } label: {
        Text("Live game")
          .font(.system(size: 17, weight: .semibold))
          .frame(maxWidth: .infinity, minHeight: 46)
          .foregroundColor(Brand.onAccent)
      }
      .buttonStyle(.plain)
      .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Brand.accent))
    } else if game.isUpcoming {
      NavigationLink { SubFlagView(game: game) } label: {
        Text(store.absentFrom.contains(game.id) ? "You're out — change" : "Can't play?")
          .font(.system(size: 16, weight: .semibold))
          .frame(maxWidth: .infinity, minHeight: 44)
          .foregroundColor(store.absentFrom.contains(game.id) ? Brand.blush : Brand.ink)
      }
      .buttonStyle(.plain)
      .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Brand.surface))
    }
  }
}

/// The card the whole app exists to show: where to be, and when.
struct GameHero: View {
  @EnvironmentObject var store: Store
  let game: Game

  var body: some View {
    Card(tinted: game.isUpcoming) {
      VStack(alignment: .leading, spacing: 6) {
        Text(eyebrow.uppercased()).label()
          .foregroundColor(game.isUpcoming ? Brand.blush : Brand.faint)

        if game.isFinal {
          // One line, no recap prose — the full write-up is a phone thing.
          Text(resultLine).font(.system(size: 22, weight: .semibold))
          Text("Full recap on the app").font(.footnote).foregroundColor(Brand.faint)
        } else {
          Text("vs \(store.opponent(of: game))")
            .font(.system(size: 22, weight: .semibold))
            .lineLimit(2)
          Text(whenLine).font(.system(size: 15, weight: .medium))
          Text(game.venue?.name ?? "Location TBD")
            .font(.system(size: 15)).foregroundColor(Brand.dim)
        }
      }
    }
  }

  private var eyebrow: String {
    if game.isFinal { return "Final" }
    if game.status == "live" { return "Live now" }
    let start = startInstant(dateISO: game.scheduledDate, startTime: game.timeSlot?.startTime)
    return countdown(to: start) ?? formatDate(game.scheduledDate)
  }

  private var whenLine: String {
    let time = slotClock(game) ?? "TBD"
    if let label = game.timeSlot?.label { return "\(time) · \(label)" }
    return time
  }

  private var resultLine: String {
    guard let mine = store.team?.teamId else { return "\(game.homeScore)–\(game.awayScore)" }
    let us = game.homeTeamId == mine ? game.homeScore : game.awayScore
    let them = game.homeTeamId == mine ? game.awayScore : game.homeScore
    return "\(us > them ? "Won" : us == them ? "Tied" : "Lost") \(us)–\(them)"
  }
}

// ---------------------------------------------------------------- live game

/// Read-only, for the nine players who aren't keeping the book.
struct LiveGameView: View {
  @EnvironmentObject var api: Api
  @EnvironmentObject var store: Store
  let game: Game

  @State private var events: [LiveEvent] = []
  @State private var canScore = false

  private var state: LiveState {
    replay(events, homeTeamId: game.homeTeamId, me: api.stored?.userId)
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        Eyebrow(text: "Live") {
          Text("Q\(state.period)").num(14).foregroundColor(Brand.ink)
        }

        HStack(alignment: .bottom) {
          scoreColumn(game.homeTeam?.name ?? "Home", state.home, leading: true)
          Spacer(minLength: 8)
          scoreColumn(game.awayTeam?.name ?? "Away", state.away, leading: false)
        }

        Card {
          VStack(alignment: .leading, spacing: 8) {
            Text("YOUR LINE").label().foregroundColor(Brand.faint)
            HStack {
              stat(state.myPoints, "PTS")
              Spacer()
              stat(state.myRebounds, "REB")
              Spacer()
              stat(state.myAssists, "AST")
              Spacer()
              stat(state.myFouls, "FLS")
            }
          }
        }

        if canScore {
          NavigationLink { ScorekeeperView(game: game, events: $events) } label: {
            Text("Keep stats")
              .font(.system(size: 16, weight: .semibold))
              .frame(maxWidth: .infinity, minHeight: 44)
              .foregroundColor(Brand.onAccent)
          }
          .buttonStyle(.plain)
          .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Brand.accent))
        }

        Text(game.venue?.name ?? "").font(.footnote).foregroundColor(Brand.faint)
      }
      .padding(.horizontal, 2)
    }
    .task { await load() }
  }

  private func scoreColumn(_ name: String, _ score: Int, leading: Bool) -> some View {
    VStack(alignment: leading ? .leading : .trailing, spacing: 0) {
      Text(name).font(.system(size: 13, weight: .medium))
        .foregroundColor(Brand.dim).lineLimit(1)
      Text("\(score)").num(40).foregroundColor(Brand.ink)
    }
  }

  private func stat(_ n: Int, _ label: String) -> some View {
    VStack(spacing: 1) {
      Text("\(n)").num(19)
      Text(label).font(.system(size: 11)).foregroundColor(Brand.faint)
    }
  }

  private func load() async {
    events = (try? await api.liveEvents(gameId: game.id)) ?? events
    if let league = store.team?.leagueId {
      canScore = (try? await api.canScore(gameId: game.id, leagueId: league)) ?? false
    }
  }
}

// -------------------------------------------------------------- scorekeeper

/// Three taps: who, what, done. There is no confirm step — a confirm on a
/// wrist doubles the taps for a mistake that is rare and already reversible.
/// Instead the entry lands immediately and offers an undo for five seconds,
/// which is how long it takes to notice you hit the wrong number.
struct ScorekeeperView: View {
  @EnvironmentObject var api: Api
  @EnvironmentObject var store: Store
  let game: Game
  @Binding var events: [LiveEvent]

  @State private var homeRoster: [RosterPlayer] = []
  @State private var awayRoster: [RosterPlayer] = []
  @State private var showingAway = false
  @State private var picked: RosterPlayer?
  @State private var undo: (uuid: String, label: String)?
  @State private var undoLeft = 0
  @State private var error: String?

  private let columns = [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)]
  private let statColumns = [
    GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6),
    GridItem(.flexible(), spacing: 6),
  ]

  private var roster: [RosterPlayer] { showingAway ? awayRoster : homeRoster }
  private var teamId: String { showingAway ? game.awayTeamId : game.homeTeamId }
  private var score: LiveState {
    replay(events, homeTeamId: game.homeTeamId, me: nil)
  }
  private var period: Int { score.period }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        if let player = picked {
          Eyebrow(text: "Step 2 · What") {
            HStack(spacing: 4) {
              if let n = player.number { Text("\(n)").num(13).foregroundColor(Brand.blush) }
              Text(player.name).font(.system(size: 14, weight: .semibold))
            }
          }
          LazyVGrid(columns: statColumns, spacing: 6) {
            ForEach(watchStats) { s in
              Button { Task { await log(s, for: player) } } label: {
                VStack(spacing: 0) {
                  Text(s.title).num(s.caption == nil ? 15 : 20, weight: .medium)
                  if let c = s.caption {
                    Text(c).font(.system(size: 10)).foregroundColor(Brand.faint)
                  }
                }
                .frame(maxWidth: .infinity, minHeight: 46)
              }
              .buttonStyle(.plain)
              .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Brand.surfaceStrong)
              )
            }
          }
          BigButton(title: "Back") { picked = nil }
        } else {
          Eyebrow(text: "Step 1 · Who") {
            Text("\(score.home)–\(score.away)").num(14)
          }
          LazyVGrid(columns: columns, spacing: 6) {
            ForEach(roster) { p in
              Button { picked = p } label: {
                HStack(spacing: 6) {
                  if let n = p.number {
                    Text("\(n)").num(15).foregroundColor(Brand.blush)
                  }
                  Text(p.name).font(.system(size: 15, weight: .medium)).lineLimit(1)
                  Spacer(minLength: 0)
                }
                .padding(.horizontal, 8)
                .frame(maxWidth: .infinity, minHeight: 44)
              }
              .buttonStyle(.plain)
              .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Brand.surfaceStrong)
              )
            }
          }
          BigButton(title: showingAway ? "\(game.homeTeam?.name ?? "Home") ›" : "\(game.awayTeam?.name ?? "Away") ›") {
            showingAway.toggle()
            picked = nil
          }
        }

        if let u = undo {
          Button { Task { await undoLast(u) } } label: {
            HStack {
              Text(u.label).font(.system(size: 14))
              Spacer()
              Text("Undo \(undoLeft)s").num(13).foregroundColor(Brand.positive)
            }
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity, minHeight: 40)
          }
          .buttonStyle(.plain)
          .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
              .fill(Brand.positive.opacity(0.16))
          )
        }

        if let error = error {
          Text(error).font(.footnote).foregroundColor(Brand.accent)
        }
      }
      .padding(.horizontal, 2)
    }
    .task { await loadRosters() }
  }

  private func loadRosters() async {
    homeRoster = (try? await api.roster(teamId: game.homeTeamId)) ?? []
    awayRoster = (try? await api.roster(teamId: game.awayTeamId)) ?? []
  }

  private func log(_ stat: StatButton, for player: RosterPlayer) async {
    error = nil
    let nextSeq = (events.map(\.seq).max() ?? 0)
    do {
      let uuid = try await api.logStat(
        gameId: game.id,
        teamId: teamId,
        userId: player.userId,
        type: stat.id,
        period: period,
        afterSeq: nextSeq
      )
      picked = nil
      undo = (uuid, "\(player.name) \(stat.caption == nil ? stat.title : stat.title + " " + (stat.caption ?? ""))")
      await countDownUndo()
      events = (try? await api.liveEvents(gameId: game.id)) ?? events
    } catch {
      self.error = error.localizedDescription
    }
  }

  /// Five seconds, ticking, then the offer disappears. Deliberately short:
  /// an undo bar that lingers is one you tap by accident two plays later.
  private func countDownUndo() async {
    undoLeft = 5
    while undoLeft > 0 {
      try? await Task.sleep(nanoseconds: 1_000_000_000)
      guard undo != nil else { return }
      undoLeft -= 1
    }
    undo = nil
  }

  private func undoLast(_ u: (uuid: String, label: String)) async {
    undo = nil
    do {
      try await api.voidStat(gameId: game.id, clientUuid: u.uuid)
      events = (try? await api.liveEvents(gameId: game.id)) ?? events
    } catch {
      self.error = error.localizedDescription
    }
  }
}

// ---------------------------------------------------------------- standings

struct StandingsView: View {
  @EnvironmentObject var store: Store

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 6) {
          Eyebrow("Standings")
          ForEach(Array(store.standings.enumerated()), id: \.element.id) { i, row in
            let mine = row.id == store.team?.teamId
            HStack(spacing: 8) {
              Text("\(i + 1)").num(13)
                .foregroundColor(mine ? Brand.blush : Brand.faint)
                .frame(width: 16, alignment: .leading)
              Text(row.name)
                .font(.system(size: 15, weight: mine ? .semibold : .regular))
                .lineLimit(1)
              Spacer(minLength: 4)
              Text("\(row.w)-\(row.l)").num(14)
                .foregroundColor(mine ? Brand.ink : Brand.dim)
            }
            .padding(.horizontal, 10)
            .frame(minHeight: 38)
            .background(
              RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(mine ? Brand.accent.opacity(0.24) : Brand.surface)
            )
          }
          SyncLine(syncedAt: store.syncedAt, online: store.online).padding(.top, 2)
        }
        .padding(.horizontal, 2)
      }
    }
  }
}

// -------------------------------------------------------------------- polls

struct PollsView: View {
  @EnvironmentObject var api: Api
  @EnvironmentObject var store: Store
  @State private var busy: String?
  @State private var error: String?

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 8) {
          Eyebrow("Polls")
          if store.polls.isEmpty {
            Card {
              Text("No open polls. When your captain proposes times, they land here.")
                .font(.footnote).foregroundColor(Brand.faint)
            }
          }
          ForEach(store.polls) { poll in
            VStack(alignment: .leading, spacing: 6) {
              Text(poll.title.isEmpty ? "Pick a slot" : poll.title)
                .font(.system(size: 15, weight: .medium)).lineLimit(2)
              ForEach(counted(poll.options, votes: store.pollVotes, me: api.stored?.userId)) { row in
                Button { Task { await tap(row) } } label: {
                  HStack(spacing: 6) {
                    VStack(alignment: .leading, spacing: 1) {
                      Text(dayLine(row.option)).font(.system(size: 15, weight: .medium))
                      if let v = row.option.venueName {
                        Text(v).font(.system(size: 12)).foregroundColor(Brand.faint)
                      }
                    }
                    Spacer(minLength: 4)
                    if busy == row.id {
                      ProgressView().scaleEffect(0.6)
                    } else {
                      Text("\(row.yes)").num(14)
                        .foregroundColor(row.myVote == "yes" ? Brand.blush : Brand.faint)
                    }
                  }
                  .padding(.horizontal, 10)
                  .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.plain)
                .background(
                  RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(row.myVote == "yes" ? Brand.accent.opacity(0.26) : Brand.surfaceStrong)
                )
              }
            }
          }
          if let error = error {
            Text(error).font(.footnote).foregroundColor(Brand.accent)
          }
        }
        .padding(.horizontal, 2)
      }
    }
  }

  private func dayLine(_ o: PollOption) -> String {
    let day = formatDate(o.scheduledDate)
    guard let slot = o.slotLabel else { return day }
    return "\(day) · \(slot)"
  }

  /// One tap votes yes; tapping your own pick takes it back. No maybe on the
  /// wrist — six maybes schedule nothing, and the student can always open
  /// the phone if they genuinely mean it.
  private func tap(_ row: CountedOption) async {
    busy = row.id
    error = nil
    do {
      if row.myVote == "yes" {
        try await api.clearVote(optionId: row.id)
      } else {
        try await api.vote(optionId: row.id)
      }
      if let season = store.team?.seasonId {
        await store.refreshSeasonExtras(seasonId: season)
      }
    } catch {
      self.error = error.localizedDescription
    }
    busy = nil
  }
}

// ---------------------------------------------------------------- sub flags

struct SubFlagView: View {
  @EnvironmentObject var api: Api
  @EnvironmentObject var store: Store
  @Environment(\.dismiss) private var dismiss
  let game: Game

  @State private var busy = false
  @State private var error: String?

  private var out: Bool { store.absentFrom.contains(game.id) }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        Text("Playing at \(slotClock(game) ?? "today") vs \(store.opponent(of: game))?")
          .font(.system(size: 17, weight: .semibold))

        if busy {
          ProgressView().frame(maxWidth: .infinity)
        } else if out {
          BigButton(title: "Actually, I'm in", style: .primary) { Task { await clear() } }
          Text("Your team knows you're out and a sub request is open.")
            .font(.footnote).foregroundColor(Brand.faint)
        } else {
          BigButton(title: "I'm in", style: .primary) { dismiss() }
          BigButton(title: "Can't play", style: .danger) { Task { await flag() } }
          Text("Flagging out asks your team for a sub, then the league pool. The other captain approves.")
            .font(.footnote).foregroundColor(Brand.faint)
        }

        if let error = error {
          Text(error).font(.footnote).foregroundColor(Brand.accent)
        }
      }
      .padding(.horizontal, 2)
    }
  }

  private func flag() async {
    guard let team = store.team?.teamId else { return }
    busy = true
    error = nil
    do {
      try await api.flagAbsence(gameId: game.id, teamId: team)
      store.absentFrom.insert(game.id)
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
    busy = false
  }

  private func clear() async {
    busy = true
    error = nil
    do {
      try await api.clearAbsence(gameId: game.id)
      store.absentFrom.remove(game.id)
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
    busy = false
  }
}

/// The captain's side: approve the specific person offered for the specific
/// game. The RPC enforces that this viewer is entitled to decide; the watch
/// just shows what it says if they are not.
struct SubApprovalsView: View {
  @EnvironmentObject var api: Api
  @EnvironmentObject var store: Store
  @State private var busy: String?
  @State private var error: String?

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        Eyebrow("Approvals")
        ForEach(store.decisionsForMe) { req in
          Card {
            VStack(alignment: .leading, spacing: 6) {
              Text("\(req.absentName) is out").font(.system(size: 16, weight: .semibold))
              Text("Sub offered: \(req.fillName ?? "someone")")
                .font(.footnote).foregroundColor(Brand.dim)
              if busy == req.id {
                ProgressView().frame(maxWidth: .infinity)
              } else {
                HStack(spacing: 6) {
                  Button { Task { await decide(req, true) } } label: {
                    Text("Approve").font(.system(size: 15, weight: .semibold))
                      .frame(maxWidth: .infinity, minHeight: 40)
                      .foregroundColor(Brand.onAccent)
                  }
                  .buttonStyle(.plain)
                  .background(RoundedRectangle(cornerRadius: 18).fill(Brand.ink))
                  Button { Task { await decide(req, false) } } label: {
                    Text("No").font(.system(size: 15, weight: .medium))
                      .frame(maxWidth: .infinity, minHeight: 40)
                  }
                  .buttonStyle(.plain)
                  .background(RoundedRectangle(cornerRadius: 18).fill(Brand.surfaceStrong))
                }
              }
            }
          }
        }
        if store.decisionsForMe.isEmpty {
          Text("Nothing waiting.").font(.footnote).foregroundColor(Brand.faint)
        }
        if let error = error {
          Text(error).font(.footnote).foregroundColor(Brand.accent)
        }
      }
      .padding(.horizontal, 2)
    }
  }

  private func decide(_ req: SubRequest, _ approve: Bool) async {
    busy = req.id
    error = nil
    do {
      try await api.decideSub(requestId: req.id, approve: approve)
      if let season = store.team?.seasonId {
        await store.refreshSeasonExtras(seasonId: season)
      }
    } catch {
      self.error = error.localizedDescription
    }
    busy = nil
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
            // .badge() doesn't exist on watchOS — trailing text instead.
            HStack {
              VStack(alignment: .leading, spacing: 2) {
                Text(slot.label).font(.footnote)
                Text("\(DAYS[slot.dayOfWeek]) · \(clock(slot.startTime))–\(clock(slot.endTime))")
                  .font(.footnote).foregroundColor(Brand.faint)
              }
              Spacer(minLength: 4)
              Text(badgeText(picked[slot.id]))
                .font(.footnote).foregroundColor(badgeColor(picked[slot.id]))
            }
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

  /// The one place positive/caution are allowed: this is the availability
  /// scale itself, not chrome.
  private func badgeColor(_ status: String?) -> Color {
    switch status {
    case "yes": return Brand.positive
    case "maybe": return Brand.caution
    case "no": return Brand.accent
    default: return Brand.faint
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
        option("In", "yes", tint: Brand.positive)
        option("Maybe", "maybe", tint: Brand.caution)
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
  @EnvironmentObject var store: Store

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 8) {
          Eyebrow("Me")
          Text(store.team?.leagueName ?? "").font(.footnote)
          Text(store.team?.teamName ?? "").font(.footnote).foregroundColor(Brand.dim)
          Text(api.stored?.email ?? "").font(.footnote).foregroundColor(Brand.faint)
          SyncLine(syncedAt: store.syncedAt, online: store.online)
          BigButton(title: "Refresh") { Task { await store.refresh() } }
          BigButton(title: "Sign out", style: .danger) { store.signOutAndForget() }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 2)
      }
    }
  }
}

// -------------------------------------------------------------------- clock

/// The slot's start as a wall clock, or nil if the game has no slot yet.
func slotClock(_ g: Game) -> String? {
  guard let t = g.timeSlot?.startTime else { return nil }
  return clock(t)
}

private func nowClock() -> String {
  let f = DateFormatter()
  f.locale = Locale(identifier: "en_US_POSIX")
  f.dateFormat = "h:mm"
  return f.string(from: Date())
}
