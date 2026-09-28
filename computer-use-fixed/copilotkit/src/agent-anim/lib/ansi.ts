/**
 * Terminal output sanitising helpers.
 *
 * OpenHands terminal observations arrive with raw VT100 escape sequences
 * (`\u001b[?2004l`, `\u001b[01;34m`, carriage returns from progress bars).
 * `stripAnsi` removes them; `cleanTerminalOutput` additionally collapses
 * carriage-return overwrites and trailing blank lines.
 */

// CSI, OSC, and single-character escapes.
const ANSI_PATTERN = new RegExp(
  [
    "[\\u001B\\u009B][[\\]()#;?]*",
    "(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))",
  ].join(""),
  "g",
);

export function stripAnsi(input: string): string {
  return input.replace(ANSI_PATTERN, "");
}

/** Apply carriage returns so `foo\rbar` renders as `bar`, like a real TTY. */
function applyCarriageReturns(line: string): string {
  if (!line.includes("\r")) return line;
  return line.split("\r").reduce((acc, chunk) => {
    if (chunk.length >= acc.length) return chunk;
    return chunk + acc.slice(chunk.length);
  }, "");
}

export function cleanTerminalOutput(input: string): string {
  const withoutAnsi = stripAnsi(input)
    // bracketed paste + cursor-position reports left by some shells
    .replace(/\u001B\][\s\S]*?(?:\u0007|\u001B\\)/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

  return withoutAnsi
    .split("\n")
    .map(applyCarriageReturns)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+$/, "");
}

/** Split cleaned output into lines, capped to the last `max` lines. */
export function toTerminalLines(input: string, max = 400): string[] {
  const lines = cleanTerminalOutput(input).split("\n");
  return lines.length > max ? lines.slice(lines.length - max) : lines;
}
