/**
 * Dependency-free token highlighter for JS/TS/Python/shell-ish snippets.
 * Deliberately small: it colours strings, comments, numbers and keywords,
 * which is all the code/diff cards need.
 */

export type Token = { value: string; kind: TokenKind };
export type TokenKind = "plain" | "keyword" | "string" | "comment" | "number" | "function";

const KEYWORDS = new Set([
  "const","let","var","function","return","if","else","for","while","import","from","export",
  "default","async","await","class","extends","new","try","catch","finally","throw","typeof",
  "interface","type","enum","public","private","readonly","as","of","in","null","undefined",
  "true","false","def","elif","print","lambda","self","None","True","False","and","or","not",
  "echo","cd","ls","npm","bun","git","sudo","pip","python","node",
]);

const PATTERN =
  /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;

export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of code.matchAll(PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ value: code.slice(last, index), kind: "plain" });
    const [value, comment, str, num, word] = match;
    if (comment) tokens.push({ value, kind: "comment" });
    else if (str) tokens.push({ value, kind: "string" });
    else if (num) tokens.push({ value, kind: "number" });
    else if (word) tokens.push({ value, kind: KEYWORDS.has(word) ? "keyword" : "plain" });
    last = index + value.length;
  }
  if (last < code.length) tokens.push({ value: code.slice(last), kind: "plain" });
  return tokens;
}

export const TOKEN_CLASS: Record<TokenKind, string> = {
  plain: "text-px-code-fg",
  keyword: "text-[#c792ea]",
  string: "text-[#c3e88d]",
  comment: "text-[#5c6370] italic",
  number: "text-[#f78c6c]",
  function: "text-[#82aaff]",
};
