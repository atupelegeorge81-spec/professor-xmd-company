import { lazy, Suspense } from "react";
import LeanApp from "./lean/LeanApp";

// UI mpya (XMD-Lean) ndiyo default. UI ya zamani bado ipo: ?old=1 (inapakiwa tu ikihitajika)
const OldChat = lazy(() => import("./Chat").then((m) => ({ default: m.Chat })));

export default function App() {
  const old = new URLSearchParams(window.location.search).get("old") === "1";
  return old ? <Suspense fallback={null}><OldChat /></Suspense> : <LeanApp />;
}
