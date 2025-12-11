# NRL Fantasy Context (Source of Truth)

Canonical background for product, copy, and test assumptions. Summarizes the Classic game rules shared by the user; treat this as the reference unless official rules change.

## Core Game Model
- Squad: 21 players under a $10,000,000 cap.
- Scoring 17 each round: 13 starters + 4 interchange count; 4 emergencies only score if needed to replace a non-playing starter/interchange.
- Captaincy: one captain each week (double points); vice-captain doubles only if captain does not play.
- Positions: Hooker (HOK), Middle (prop/lock), Edge (second-row), Half (halves), Centre, Wing/Fullback. Some players have dual-position (DPP) eligibility (e.g., wing/centre, middle/edge).
- Typical starting 13: 1 HOK, 3 Middles, 2 Edges, 2 Halves, 2 Centres, 3 Wing/Fullbacks.
- Auto-sub logic: if a starter is out, the highest-ranked eligible bench player fills the slot; if no eligible cover exists, the slot scores 16 and the first emergency slides into the open bench spot. DPP helps keep coverage.

## Pricing, Scoring, and Trades
- Fantasy points come from in-game stats (tries, tackles, metres, etc.) and update weekly.
- Break-even (BE) is roughly `price / 13,800`. Above BE -> price rises; below BE -> price falls.
- Strategy: buy undervalued "cash cows" below BE, sell after price rises to fund upgrades.
- Trades: 44 total per season (commonly 2 per round in Rounds 1-6, then more later). Use trades sparingly to balance short-term fixes with long-term value.

## Byes and State of Origin
- Byes: players on bye score zero. Early rounds still use 17 scorers; during Origin bye rounds only the best 13 scores count (bench/emergency beyond 13 are ignored).
- Major bye rounds (2025 example): R13, R16, R19 have seven teams off; fielding 13 active players is critical.
- Planning: favor "bye-proof" teams/players; trim rosters heavy with clubs carrying multiple byes (e.g., Broncos, Cowboys, Panthers, Storm, Warriors often have 2 of the 3 major byes; some add a third bye later).
- Attractive schedules (2024-25 examples): Dolphins (no major-bye absences), Rabbitohs, Eels, Raiders (selected players listed below).
- State of Origin: selected players miss at least the Origin weeks and are often rested in the rounds immediately after (e.g., R14, R17, R20). Minimize reliance on likely Origin call-ups during that window or plan temporary trades.

### Notable Bye-Friendly Targets (examples from shared guide)
- Reece Robson (Rabbitohs) - plays 5 of 6 major bye rounds.
- J'Maine Hopgood (Eels, DPP middle/edge) - plays 5 of 6.
- Joseph Tapine (Raiders) - plays 4 of 6; low Origin risk.
- Mitch Moses / Dylan Brown (Eels halves) - collectively cover Eels byes.
- Shaun Johnson (Warriors) - plays 5 of 6 major byes.
- Jack Bird / Connolly Lemuelu (Wests Tigers centres) - pair covers 4 of 6.
- Others cited: Lachie Miller (Sharks), Tyson Frizell (Dragons) each 4 of 6; Jackson Ford (Cowboys) 5 of 6; Hamiso Tabuai-Fidow (Dolphins) 5 of 6.

### Players to Treat with Caution During Origin/Byes
- Likely Origin halves (e.g., Nicho Hynes, Jarome Luai) and other call-up candidates who can miss R13-15 and be rested after.
- Rosters overloaded with Broncos or Cowboys (carry two major byes plus a third later in 2025).

## Looping (Emergency / VC Loophole)
- Concept: intentionally include a known non-playing player in the 17 to choose between two bench scores.
- Steps:
  1) Pick Player A (early game) as first emergency and Player B (later game) in the 17 alongside a known non-player.
  2) After Player A plays, decide:
     - If Player A scored well: swap Player B out for the non-player before Player B's game so the auto-sub pulls in Player A's score.
     - If Player A scored poorly: do nothing; keep Player B active.
- Requirements and risks:
  - Non-player should be on a scheduled bye or guaranteed DNP before the round starts; if a listed 18th man unexpectedly takes the field, the loop fails and may add a low score.
  - Omitted/injured players lock once their team plays, removing flexibility.

## Quick Reference
- Squad: 21 total; cap $10M.
- Scoring each round: starters 13 + 4 interchange; emergencies only if needed.
- Captain: double points; VC covers if captain DNP.
- Trades: 44 per season; conserve around Origin byes.
- BE math: price / 13,800 (approx).
- Origin bye rounds: best 13 only; ensure coverage and avoid stacked bye teams.

Sources cited by the user: amateursfantasysports.com, nrl.com, reddit.com, talkingleaguepod.com.
