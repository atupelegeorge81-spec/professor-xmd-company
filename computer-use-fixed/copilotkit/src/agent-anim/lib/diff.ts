/**
 * Minimal LCS line diff — no dependency, enough for the diff card.
 */

export type DiffLine = {
  type: "add" | "remove" | "context";
  content: string;
  oldNumber?: number | undefined;
  newNumber?: number | undefined;
};

export type DiffStats = { additions: number; deletions: number };

export function computeLineDiff(before: string, after: string): DiffLine[] {
  const a = before.length ? before.split("\n") : [];
  const b = after.length ? after.split("\n") : [];

  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      const row = table[i]!;
      const next = table[i + 1]!;
      row[j] = a[i] === b[j] ? next[j + 1]! + 1 : Math.max(next[j]!, row[j + 1]!);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldNumber = 1;
  let newNumber = 1;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ type: "context", content: a[i]!, oldNumber: oldNumber++, newNumber: newNumber++ });
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      lines.push({ type: "remove", content: a[i]!, oldNumber: oldNumber++ });
      i += 1;
    } else {
      lines.push({ type: "add", content: b[j]!, newNumber: newNumber++ });
      j += 1;
    }
  }
  while (i < a.length) lines.push({ type: "remove", content: a[i++]!, oldNumber: oldNumber++ });
  while (j < b.length) lines.push({ type: "add", content: b[j++]!, newNumber: newNumber++ });

  return lines;
}

export function diffStats(lines: DiffLine[]): DiffStats {
  return lines.reduce<DiffStats>(
    (acc, line) => {
      if (line.type === "add") acc.additions += 1;
      if (line.type === "remove") acc.deletions += 1;
      return acc;
    },
    { additions: 0, deletions: 0 },
  );
}
