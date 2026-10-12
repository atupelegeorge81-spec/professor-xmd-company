// src/lib/milestone/types.ts — TypeScript types za mfumo wa milestones (maelezo.md sehemu 5).
// Chanzo kimoja cha kweli cha maumbo; validators zipo schemas.ts. zod haipo repo — validators za mkono.

/* ---------- 5.1 MilestoneMap ---------- */
export type ReviewMode = "visual" | "technical" | "mixed";

export interface Milestone {
  id: string; // "M1"
  title: string;
  agendas: { from: number; to: number };
  phase: string; // "foundation" n.k. — maelezo huru
  reviewMode: ReviewMode;
  roster: string[]; // AGENT ids halali (pm/designer/frontend/backend/qa) — schemas.ts inanormaliza majina
  rationale: string;
}

export interface MilestoneMap {
  version: 1;
  sessionId: string;
  totalAgendas: number;
  generatedBy: string; // mfano "optimus@gemini-flash"
  usedFallback: boolean;
  milestones: Milestone[];
}

/* ---------- 5.2 MilestoneState ---------- */
export type MilestoneStatus =
  | "DISCUSSING" | "PLANNING" | "BUILDING" | "EVIDENCE"
  | "REVIEW_R0" | "FIXING" | "VERIFYING"
  | "SIGNED_OFF" | "SIGNED_OFF_WITH_WAIVERS"
  | "CAP_REACHED" | "BLOCKED" | "PAUSED_QUOTA" | "PAUSED_INFRA";

export const TERMINAL_OK: MilestoneStatus[] = ["SIGNED_OFF", "SIGNED_OFF_WITH_WAIVERS"];

export interface LaneCall {
  call: string; // "M1.R0.designer.analyse"
  lane: string; // "gemini-flash@key2"
  visionCapable: boolean;
  tokens?: number;
  ms?: number;
  fallback?: boolean; // ilikuwa fallback baada ya lane ya kwanza kushindwa
}

export interface MilestoneState {
  id: string; // "M1"
  status: MilestoneStatus;
  /** PAUSED_* ikirudishwa: hali iliyokuwepo kabla ya pause (resume inarudi hapa). */
  pausedFrom?: MilestoneStatus;
  round: number; // 0 = Raundi 0 (ukaguzi wa kwanza); 1..10 raundi za marekebisho
  maxRounds: number; // 10
  currentStepId: string; // "M1.R3.verify"
  startedAt: string; // ISO
  updatedAt: string; // ISO
  lanesUsed: LaneCall[];
}

/* ---------- 8.3 Vipimo vya kukubalika (Acceptance Checks) ---------- */
export type CheckType =
  | "command" | "grep" | "dom_exists" | "computed_style" | "no_horizontal_overflow"
  | "console_clean" | "contrast_min" | "touch_target_min" | "http"
  | "file_exists" | "file_contains" | "screenshot_taken";

export interface AcceptanceCheck {
  id?: string; // "C-007" — hugawanywa na checks.ts ikiwa hakuna
  type: CheckType;
  // command
  cmd?: string; exitCode?: number;
  // grep
  pattern?: string; paths?: string[]; count?: number; // count = matarajio ya idadi (default 0 kwa marufuku)
  // dom checks
  route?: string; routes?: string[]; selector?: string; viewports?: string[];
  // computed_style
  property?: string; expected?: string; forbidden?: string[];
  // contrast / touch
  min?: number; px?: number;
  // http
  method?: string; url?: string; status?: number; bodyContains?: string;
  // files
  path?: string; text?: string;
  // screenshot_taken
  state?: string;
  note?: string; // maelezo huru kwa wakaguzi
}

export type CheckResultStatus = "PASS" | "FAIL" | "SKIP" | "ERROR";
export interface CheckResult {
  id: string; // "C-007"
  type: CheckType;
  result: CheckResultStatus;
  detail: string;
}

/* ---------- 5.4 Defect ---------- */
export type DefectSeverity = "blocker" | "major" | "medium" | "minor";
export type DefectStatus = "OPEN" | "IN_FIX" | "VERIFIED_FIXED" | "WAIVED" | "INHERITED" | "REOPENED";

/** Msimbo wa utambuzi wa chanzo (7.4 jaribio 2) — unachaguliwa na Optimus, unaendeshwa na code. */
export type DiagnosisCode =
  | "NOT_ATTEMPTED" | "ATTEMPTED_WRONG" | "AMBIGUOUS_ORDER"
  | "CONFLICT_WITH_DECISION" | "TECH_BLOCKER" | "REGRESSION_CAUSED";

export interface DefectHistoryEntry {
  round: number;
  result: "PASS" | "FAIL" | "PARTIAL";
  cause?: DiagnosisCode;
}

export interface Defect {
  id: string; // "D-004"
  milestoneId: string;
  foundInRound: number;
  reportedBy: string[]; // majukumu mara mbili: ["designer","frontend"]
  area: string;
  severity: DefectSeverity;
  title: string;
  evidence: string[]; // ["S-001","C-003"]
  expected: string;
  actual: string;
  status: DefectStatus;
  attempts: number;
  history: DefectHistoryEntry[];
  /** (7.5) meta ya waive — inapowekwa status="WAIVED"; sehemu 4 ya ripoti haisemi sababu zisizotokea */
  waiveReason?: string;
  waiveApprovedBy?: string[];
}

/* ---------- 5.5 ChangeOrder ---------- */
export type COMode = "standard" | "concrete" | "pair_patch" | "split" | "redecide";

export interface ChangeOrder {
  id: string; // "CO-012"
  defectIds: string[];
  attempt: number;
  priority: number; // 1 = ya juu zaidi
  location: { files: string[]; route?: string; selector?: string };
  current: string;
  desired: string;
  visionNote?: string;
  acceptance: AcceptanceCheck[]; // LAZIMA zisizo tupu (validator)
  diagnosis?: DiagnosisCode;
  mode: COMode;
  patch?: string | null; // pair_patch: unified diff au code kamili iliyoandikwa na Frontend
}

/* ---------- 5.6 Receipt ---------- */
export type ReceiptStatus = "DONE" | "PARTIAL" | "BLOCKED" | "CANNOT";

export interface ReceiptFile {
  path: string;
  summary: string;
  before?: string;
  after?: string;
}

export interface Receipt {
  orderId: string;
  status: ReceiptStatus;
  filesChanged: ReceiptFile[];
  commandsRun: string[];
  notes?: string;
  blockedReason?: string | null;
}

/* ---------- 5.3 EvidencePack ---------- */
export interface EvidenceShot { id: string; route: string; viewport: string; state: string; path: string; }
export interface EvidenceDom { screenshotId: string; path: string; }
export interface EvidenceCommand { cmd: string; exit: number; logPath?: string; }
export interface GitDiffSummary { filesChanged: number; insertions: number; deletions: number; }
export interface RegressionEntry { route: string; viewport: string; changedPct: number; }

export interface EvidencePack {
  milestoneId: string;
  round: number;
  screenshots: EvidenceShot[];
  domMetrics: EvidenceDom[];
  checks: CheckResult[];
  commands: EvidenceCommand[];
  gitDiffSummary: GitDiffSummary;
  regression: RegressionEntry[];
  consoleErrors: string[];
}

/* ---------- 5.8 ChangeRequest ---------- */
export type ChangeRequestStatus = "PROPOSED" | "ACCEPTED" | "REJECTED";
export interface ChangeRequest {
  id: string; // "CR-003"
  from: string; // "Agenda 9"
  affects: string[]; // ["M1: A3 header"]
  proposal: string;
  status: ChangeRequestStatus;
  appliedInMilestone?: string;
}

/* ---------- Hukumu za wakaguzi na sign-off ---------- */
export type VerdictLetter = "PASS" | "FAIL" | "PARTIAL";

export interface ReviewSignature {
  reviewer: string; // jukumu: "designer" | "frontend" | nyingine kwa technical
  verdict: VerdictLetter;
  note?: string;
}

export type RedecideAction = "KEEP" | "MODIFY" | "WAIVE";

export interface SignOff {
  milestoneId: string;
  status: "SIGNED_OFF" | "SIGNED_OFF_WITH_WAIVERS";
  reviewers: ReviewSignature[];
  checksSummary: { passed: number; failed: number; skipped: number };
  openDefectsAtSign: string[]; // minor tu (wavere zimehesabiwa)
  waivedDefects: { id: string; reason: string; approvedBy: string[] }[];
  at: string; // ISO
}

/* ---------- 5.9 RoundHeader ---------- */
export interface RoundHeaderParts {
  round: number;
  maxRounds: number;
  milestoneId: string;
  closed: number;
  open: { id: string; attempts: number }[];
  waivers: number;
  roundsLeft: number;
}

/* ---------- Matokeo ya uchambuzi wa mkaguzi (LLM → validator) ---------- */
export interface AnalystOutput {
  reviewer: string;
  findings: string; // uchambuzi wa bure (maradufu yanaruhusiwa)
  defects: Omit<Defect, "status" | "attempts" | "history">[];
  suggestions: { title: string; detail: string }[]; // mapendekezo (si makosa) — hayaezi kwenda ledger bila kukubaliwa na wote
}

/* ---------- run-level (hifadhi ya chip — state.ts) ---------- */
export interface StepRecord {
  stepId: string;
  result: string; // "DONE" au ufupisho wa matokeo
  at: string; // ISO
}

export interface MilestonesRunState {
  version: 1;
  sessionId: string;
  map: MilestoneMap;
  states: Record<string, MilestoneState>;
  currentMilestoneId: string | null;
  defects: Defect[]; // ledger ya makosa (D-### inahifadhiwa hapa kwa run nzima)
  cos: ChangeOrder[];
  crs: ChangeRequest[];
  signoffs: SignOff[];
  stepsDone: Record<string, StepRecord>; // stepId (11.2) — idempotency
  /** Mpango wa kila milestone (4.5) — inahifadhiwa kwa resume (CU anahitaji md ileile) */
  plans: Record<string, { md: string; title: string; checks: AcceptanceCheck[]; attempts: number }>;
  /** Ushahidi kwa raundi ("M1.R2" → EvidencePack) */
  evidence: Record<string, EvidencePack>;
  visionDegraded?: boolean; // 10.3: mlolongo umepoteza lane yenye vision — SIGN-OFF ya visual inasubiri
}
