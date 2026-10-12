
## v-milestones P3 (2026-10-12) — Orchestration core + wiring
- engine.ts: CuPhaseOpts (planOverride/phaseLabel/extraBrief) + beginNewCuPhase() per milestone/round
- milestone/: planGen, startPack, orchestrate (raundi-10 pipeline + NO-OP diagnosis + escalation), reviewLLM (judge deps), hostRun, depsAdapter
- ocb.ts: kurejeshwa P1 byte-exact kutoka snapshots + wiring helpers (ocbForAgendaDiscussion)
- boardRunner: roster-gate (4.3), OCB injection (6.1.2), old-CU routing (!msRun), milestones host trigger (idempotent)
- Tests: 310/310; tsc clean. Maelezo: docs/PROGRESS.md P3 kigezo.
