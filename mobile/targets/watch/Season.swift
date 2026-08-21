// Subs and scheduling polls — the two things a student needs to *decide*
// during the school day, as opposed to read.
//
// Both mirror the server actions in app/(app)/league/[slug]/subs/actions.ts
// and .../polls/actions.ts step for step, including the guards. Where those
// call a security-definer RPC, so does this: the rules they enforce are
// transitions ("only a proposed request may be approved", "only the opposing
// captain may approve it") that a row policy structurally cannot express, so
// the function is the only correct door and every client uses it.

import Foundation

// ------------------------------------------------------------------- models

struct SubRequest: Codable, Identifiable {
  struct Person: Codable { let fullName: String? }
  struct TeamName: Codable { let name: String }

  let id: String
  let gameId: String
  let teamId: String
  let absentUserId: String?
  let fillUserId: String?
  let scope: String
  let status: String
  let note: String
  let absent: Person?
  let fill: Person?
  let team: TeamName?

  var absentName: String { absent?.fullName ?? "A player" }
  var fillName: String? { fill?.fullName }
  var teamName: String { team?.name ?? "" }
  var needsDecision: Bool { status == "proposed" }
}

struct PollOption: Codable, Identifiable {
  struct SlotName: Codable { let label: String? }
  struct VenueName: Codable { let name: String? }

  let id: String
  let scheduledDate: String
  let slot: SlotName?
  let venue: VenueName?

  var slotLabel: String? { slot?.label }
  var venueName: String? { venue?.name }
}

struct PollVote: Codable {
  let optionId: String
  let userId: String
  let vote: String
}

struct SchedulePoll: Codable, Identifiable {
  let id: String
  let title: String
  let status: String
  let options: [PollOption]

  var isOpen: Bool { status == "open" }
}

/// A poll option with its tally folded in, ready to render. Counting happens
/// here rather than in the view so the row is a value, not a lookup.
struct CountedOption: Identifiable {
  let option: PollOption
  var yes = 0
  var maybe = 0
  var no = 0
  var myVote: String?

  var id: String { option.id }
  /// Same weighting the lock_schedule_poll RPC uses to pick a winner: a
  /// maybe is worth half a yes. Shown so the leader on screen is the one
  /// that would actually win.
  var score: Double { Double(yes) + Double(maybe) * 0.5 }
}

// ---------------------------------------------------------------------- api

extension Api {

  // ------------------------------------------------------------- absences

  /// "I can't play." A port of flagAbsence: record the absence, then open at
  /// most one sub request for it. The one-open-request check is the reason
  /// tapping twice does not spam the league pool.
  ///
  /// Deliberately ungated — anyone may say they are out, and anyone may
  /// offer to fill in. The gate is the *approval*, one step later, which is
  /// where a team could otherwise quietly hand itself a ringer.
  func flagAbsence(gameId: String, teamId: String, reason: String = "") async throws {
    guard let uid = stored?.userId else { throw ApiError(message: "Signed out.") }
    try await write(
      "game_absences",
      ["game_id": gameId, "user_id": uid, "team_id": teamId, "reason": reason],
      onConflict: "game_id,user_id",
      failure: "Couldn't flag that. Check your connection and tap again."
    )

    struct Existing: Codable { let id: String }
    let open: [Existing] = try await get("sub_requests", [
      "select": "id",
      "game_id": "eq.\(gameId)",
      "absent_user_id": "eq.\(uid)",
      "status": "in.(open,proposed,approved)",
      "limit": "1",
    ])
    guard open.isEmpty else { return }

    try await write(
      "sub_requests",
      [
        "game_id": gameId,
        "team_id": teamId,
        "requested_by": uid,
        "absent_user_id": uid,
        "scope": "league",
        "note": reason,
      ],
      failure: "You're marked out, but the sub request didn't open. Try again."
    )
  }

  /// Undo the flag. Clears the absence and cancels the request it opened —
  /// but only while nobody has been approved, because withdrawing after a
  /// sub is locked in would silently drop that person from the roster.
  func clearAbsence(gameId: String) async throws {
    guard let uid = stored?.userId else { throw ApiError(message: "Signed out.") }
    try await delete("game_absences", [
      "game_id": "eq.\(gameId)", "user_id": "eq.\(uid)",
    ])
    try await patch(
      "sub_requests",
      ["status": "cancelled"],
      [
        "game_id": "eq.\(gameId)",
        "absent_user_id": "eq.\(uid)",
        "status": "in.(open,proposed)",
      ]
    )
  }

  /// Which of these games this user has flagged out of. One query for the
  /// whole day rather than one per fixture — the watch is often on a single
  /// bar of school wifi, and round trips are the thing it cannot afford.
  func myAbsences(gameIds: [String]) async throws -> Set<String> {
    guard let uid = stored?.userId, !gameIds.isEmpty else { return [] }
    struct Row: Codable { let gameId: String }
    let rows: [Row] = try await get("game_absences", [
      "select": "game_id",
      "game_id": "in.(\(gameIds.joined(separator: ",")))",
      "user_id": "eq.\(uid)",
    ])
    return Set(rows.map(\.gameId))
  }

  // ----------------------------------------------------------------- subs

  private static let subSelect = """
    id,game_id,team_id,absent_user_id,fill_user_id,scope,status,note,\
    absent:profiles!sub_requests_absent_user_id_fkey(full_name),\
    fill:profiles!sub_requests_fill_user_id_fkey(full_name),\
    team:teams(name)
    """

  /// Requests waiting on somebody. RLS already limits this to games in
  /// leagues the viewer belongs to, so the watch does not re-derive that.
  func subRequests(gameIds: [String]) async throws -> [SubRequest] {
    guard !gameIds.isEmpty else { return [] }
    return try await get("sub_requests", [
      "select": Self.subSelect,
      "game_id": "in.(\(gameIds.joined(separator: ",")))",
      "status": "in.(open,proposed)",
      "order": "created_at.desc",
    ])
  }

  /// Approve or decline. The RPC checks that the caller is the *opposing*
  /// captain or a league admin and that the request is still proposed; the
  /// watch does not try to second-guess it, and surfaces whatever it raises.
  func decideSub(requestId: String, approve: Bool) async throws {
    try await rpc("decide_sub_request", [
      "p_request": requestId, "p_approve": approve, "p_note": "",
    ])
  }

  /// Volunteer to fill in. Also an RPC, for a subtler reason: at the moment
  /// the policy is evaluated the volunteer is not yet on the row, so a
  /// `fill_user_id = auth.uid()` rule could never match and nobody outside
  /// the team could ever step in — which is the entire point of a pool.
  func claimSub(requestId: String) async throws {
    guard let uid = stored?.userId else { throw ApiError(message: "Signed out.") }
    try await rpc("claim_sub_request", ["p_request": requestId, "p_fill": uid])
  }

  // ---------------------------------------------------------------- polls

  func openPolls(seasonId: String) async throws -> [SchedulePoll] {
    try await get("schedule_polls", [
      "select": """
        id,title,status,\
        options:schedule_poll_options(id,scheduled_date,\
        slot:time_slots(label),venue:venues(name))
        """,
      "season_id": "eq.\(seasonId)",
      "status": "eq.open",
      "order": "created_at.desc",
    ])
  }

  func pollVotes(optionIds: [String]) async throws -> [PollVote] {
    guard !optionIds.isEmpty else { return [] }
    return try await get("schedule_poll_votes", [
      "select": "option_id,user_id,vote",
      "option_id": "in.(\(optionIds.joined(separator: ",")))",
    ])
  }

  /// One tap is a yes. The web offers yes/maybe/no; a wrist gets the one
  /// that moves the decision, because "maybe" from six people schedules
  /// nothing. Tapping the option you already picked clears it.
  func vote(optionId: String, vote: String = "yes") async throws {
    guard let uid = stored?.userId else { throw ApiError(message: "Signed out.") }
    try await write(
      "schedule_poll_votes",
      ["option_id": optionId, "user_id": uid, "vote": vote],
      onConflict: "option_id,user_id",
      failure: "Your vote didn't save. Tap again."
    )
  }

  func clearVote(optionId: String) async throws {
    guard let uid = stored?.userId else { throw ApiError(message: "Signed out.") }
    try await delete("schedule_poll_votes", [
      "option_id": "eq.\(optionId)", "user_id": "eq.\(uid)",
    ])
  }

  // ------------------------------------------------------------- plumbing

  func delete(_ path: String, _ filters: [String: String]) async throws {
    try await mutate(path, method: "DELETE", filters: filters, body: nil)
  }

  func patch(_ path: String, _ body: [String: Any], _ filters: [String: String]) async throws {
    try await mutate(path, method: "PATCH", filters: filters, body: body)
  }

  private func mutate(
    _ path: String, method: String, filters: [String: String], body: [String: Any]?
  ) async throws {
    let token = try await validToken()
    var comps = URLComponents(
      url: Supabase.url.appendingPathComponent("rest/v1/\(path)"),
      resolvingAgainstBaseURL: false
    )!
    comps.queryItems = filters.map { URLQueryItem(name: $0.key, value: $0.value) }
    var req = URLRequest(url: comps.url!)
    req.httpMethod = method
    req.setValue(Supabase.anonKey, forHTTPHeaderField: "apikey")
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
    if let body = body {
      req.setValue("application/json", forHTTPHeaderField: "Content-Type")
      req.httpBody = try JSONSerialization.data(withJSONObject: body)
    }
    let (_, resp) = try await URLSession.shared.data(for: req)
    let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
    guard code == 200 || code == 204 else {
      throw ApiError(message: "That didn't save. Check your connection and try again.")
    }
  }
}

// ------------------------------------------------------------------ folding

/// Fold votes into options. Kept out of the view so the counting is a pure
/// function of two arrays, and so the "which one is winning" rule lives in
/// exactly one place.
func counted(_ options: [PollOption], votes: [PollVote], me: String?) -> [CountedOption] {
  var byOption: [String: CountedOption] = [:]
  for o in options { byOption[o.id] = CountedOption(option: o) }
  for v in votes {
    guard var row = byOption[v.optionId] else { continue }
    switch v.vote {
    case "yes": row.yes += 1
    case "maybe": row.maybe += 1
    case "no": row.no += 1
    default: break
    }
    if let me = me, v.userId == me { row.myVote = v.vote }
    byOption[v.optionId] = row
  }
  // Date order, not score order: a list that reorders itself under your
  // finger as votes arrive is how you vote for the wrong day.
  return options.compactMap { byOption[$0.id] }
}
