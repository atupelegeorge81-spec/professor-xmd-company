// P1 — OCB snapshot tests kwa kila hatua × jukumu (maelezo.md 6.1.4).
import { describe, expect, it } from "vitest";
import { buildOCB, buildOCBC, type TeamMember } from "./ocb";
import { initMilestonesRun, advance } from "./state";
import { validateMilestoneMap } from "./schemas";

const TEAM: TeamMember[] = [
  { id: "pm", name: "Optimus", role: "Project Manager" },
  { id: "designer", name: "Ultron", role: "UI/UX Designer" },
  { id: "frontend", name: "Vextron", role: "Frontend Engineer" },
  { id: "backend", name: "Megatron", role: "Backend & DB Engineer" },
  { id: "qa", name: "Cybertron", role: "QA & DevOps Engineer" },
];

function fixtureRun() {
  const map = validateMilestoneMap({
    sessionId: "s1", totalAgendas: 7, generatedBy: "optimus@gemini-flash", usedFallback: false,
    milestones: [
      { id: "M1", title: "Msingi", agendas: { from: 1, to: 3 }, phase: "foundation", reviewMode: "visual", roster: ["pm", "designer", "frontend"], rationale: "r" },
      { id: "M2", title: "Backend", agendas: { from: 4, to: 7 }, phase: "backend", reviewMode: "technical", roster: ["pm", "backend", "qa"], rationale: "r" },
    ],
  }, 7, "s1");
  if (!map.ok) throw new Error(map.errors.join());
  const run = initMilestonesRun("s1", map.value);
  advance(run, "M1", "PLANNING", "M1.P.plan");
  run.defects.push({
    id: "D-004", milestoneId: "M1", foundInRound: 1, reportedBy: ["designer"], area: "header",
    severity: "major", title: "Toggle haipo", evidence: ["S-001"], expected: "X", actual: "Y",
    status: "OPEN", attempts: 2, history: [],
  });
  return { run, map: map.value };
}

const base = { project: "Duka la Mitumba Temeke", brief: "duka la mtandaoni la nguo", team: TEAM };

describe("P1·milestones · OCB snapshots (kila hatua × jukumu)", () => {
  const steps: { step: string; round?: number; milestoneId?: string; next: string; reader?: string }[] = [
    { step: "kuchambua ramani ya milestones", next: "mjadala wa agenda 1", reader: "Board nzima" },
    { step: "mjadala wa agenda 2", next: "kufungwa kwa agenda 2 → ledger", reader: "Optimus (mini-report)" },
    { step: "kupanga Mpango wa Milestone (M1)", milestoneId: "M1", next: "Computer anajenga", reader: "XMD Computer — atatekeleza neno kwa neno" },
    { step: "ukaguzi wa Raundi 0: uchambuzi wa kujitegemea", milestoneId: "M1", round: 0, next: "mjadala wa timu → CO", reader: "wakaguzi wenzake (kwa mjadala)" },
    { step: "uthibitisho wa raundi 2", milestoneId: "M1", round: 2, next: "hukumu ya CO → Optimus", reader: "Optimus (sign-off gate)" },
  ];
  for (const roleId of ["pm", "designer", "frontend", "backend"]) {
    for (const s of steps) {
      it(`${roleId} @ ${s.step}`, () => {
        const { run, map } = fixtureRun();
        const ocb = buildOCB({ ...base, run, map, roleId, ...s });
        expect(ocb).toMatchSnapshot();
      });
    }
  }

  it("ramani ya mfumo haibadiliki kwa mtu — sehemu ya MTIRIRIKO ni ileile kote", () => {
    const { run, map } = fixtureRun();
    const a = buildOCB({ ...base, run, map, roleId: "pm", step: "kuchambua ramani", next: "-" });
    const b = buildOCB({ ...base, run, map, roleId: "designer", step: "kuchambua ramani", next: "-" });
    const flow = (s: string) => s.slice(s.indexOf("MTIRIRIKO WA OPERESHENI:"), s.indexOf("UKO HAPA:"));
    expect(flow(a)).toBe(flow(b));
  });

  it("hali (kufungwa/makosa/waivers) huonekana kwenye OCB", () => {
    const { run, map } = fixtureRun();
    const ocb = buildOCB({ ...base, run, map, roleId: "pm", step: "uthibitisho wa raundi 2", milestoneId: "M1", round: 2, next: "sign-off" });
    expect(ocb).toContain("makosa wazi: 1");
    expect(ocb).toContain("waivers: 0");
    expect(ocb).toContain("RAUNDI 2/10");
    expect(ocb).toContain("Milestone M1: Msingi (agenda 1–3) 1/2");
  });

  it("OCB-C (6.3): mkataba wa kumaliza + wakaguzi + ⚠️ CONFLICT", () => {
    const { run, map } = fixtureRun();
    const c = buildOCBC({ ...base, run, map, roleId: "pm", step: "ujenzi", milestoneId: "M1", round: 0, next: "ushahidi" });
    expect(c).toContain("TOLEO LA COMPUTER (OCB-C)");
    expect(c).toContain("RISITI");
    expect(c).toContain("HUTAMALIZA hadi");
    expect(c).toContain("USIJIPE ALAMA; harness itapima");
    expect(c).toContain("⚠️ CONFLICT");
    expect(c).toMatchSnapshot();
  });

  it("OCB-C raundi>0 inasema raundi ya marekebisho", () => {
    const { run, map } = fixtureRun();
    const c = buildOCBC({ ...base, run, map, roleId: "pm", step: "marekebisho", milestoneId: "M1", round: 2, next: "-" });
    expect(c).toContain("raundi 2/10 ya marekebisho ya CO");
  });

  it("backend hayupo roster ya M1 — unaonyeshwa (ama juani)", () => {
    const { run, map } = fixtureRun();
    const ocb = buildOCB({ ...base, run, map, roleId: "designer", step: "mjadala", milestoneId: "M1", next: "-" });
    expect(ocb).toContain("Megatron");
    expect(ocb).toContain("hayupo kwenye roster");
  });
});
