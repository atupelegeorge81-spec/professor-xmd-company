// src/lib/milestone/receipts.test.ts — mkataba wa risiti halisi (C1)
import { describe, expect, it } from "vitest";
import { extractJsonObject, parseReceiptFiles, receiptFetchShell } from "./receipts";

const VALID = {
  orderId: "CO-0007",
  status: "DONE",
  filesChanged: [{ path: "src/lib/x.ts", summary: "fix overflow" }],
  commandsRun: ["npm run build"],
  notes: "imekufa kufa",
};

describe("parseReceiptFiles", () => {
  it("hupitisha risiti halali kwa normalization ya defaults", () => {
    const rs = parseReceiptFiles({ "CO-0007.json": JSON.stringify(VALID) });
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({
      orderId: "CO-0007",
      status: "DONE",
      commandsRun: ["npm run build"],
      blockedReason: null,
    });
  });

  it("BLOCKED/CANNOT yenye filesChanged tupu + blockedReason ni halali", () => {
    const rs = parseReceiptFiles({
      "CO-0009.json": JSON.stringify({ orderId: "CO-0009", status: "BLOCKED", filesChanged: [], blockedReason: "API haipo" }),
    });
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ status: "BLOCKED", filesChanged: [], blockedReason: "API haipo" });
  });

  it("hutupa faili zenye JSON ovyo au orderId ikose (gate itahesabia NOT_ATTEMPTED)", () => {
    const rs = parseReceiptFiles({
      "mbovu1.json": "{ hapa si JSON",
      "CO-1.json": JSON.stringify({ status: "DONE", filesChanged: [] }), // orderId haipo
      "CO-2.json": JSON.stringify({ orderId: "CO-2", status: "MBELE", filesChanged: [] }), // status mbaya
      "CO-3.json": JSON.stringify(VALID), // ya kwanza kushinda
    });
    expect(rs.map((r) => r.orderId)).toEqual(["CO-0007"]);
  });

  it("hupokea JSON iliyofungwa na ```json fences na prose", () => {
    const txt = "Hapa ndiyo risiti yangu:\n```json\n" + JSON.stringify(VALID) + "\n```\nAsante.";
    const rs = parseReceiptFiles({ "CO-0007.json": txt });
    expect(rs).toHaveLength(1);
    expect(rs[0].orderId).toBe("CO-0007");
  });

  it("duplicate orderId → ya kwanza ndiyo inabaki (no double-count)", () => {
    const rs = parseReceiptFiles({
      "a.json": JSON.stringify(VALID),
      "b.json": JSON.stringify({ ...VALID, notes: "nafasi ya pili" }),
    });
    expect(rs).toHaveLength(1);
  });

  it("orodha inapangwa kwa orderId (deterministic)", () => {
    const rs = parseReceiptFiles({
      "z.json": JSON.stringify({ ...VALID, orderId: "CO-0010" }),
      "a.json": JSON.stringify({ ...VALID, orderId: "CO-0002" }),
    });
    expect(rs.map((r) => r.orderId)).toEqual(["CO-0002", "CO-0010"]);
  });
});

describe("extractJsonObject", () => {
  it("hukata object kutoka kwa maandishi yenye kengele", () => {
    expect(JSON.parse(extractJsonObject('kabla {"a":1,"b":{"c":2}} baada')!)).toEqual({ a: 1, b: { c: 2 } });
  });
  it("hutupa null kama hakuna object", () => {
    expect(extractJsonObject("hakuna kitu hapa")).toBeNull();
  });
});

describe("receiptFetchShell", () => {
  it("inatumia dir ya .xmd/receipts na marker za kugawanya faili", () => {
    const cmd = receiptFetchShell();
    expect(cmd).toContain(".xmd/receipts");
    expect(cmd).toContain("@@@RECEIPT:");
    expect(cmd).toContain("*.json");
  });
});
