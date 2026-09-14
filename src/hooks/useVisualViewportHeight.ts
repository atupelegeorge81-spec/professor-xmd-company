"use client";
import { useEffect } from "react";

/**
 * Inaweka --app-height sahihi kulingana na visualViewport halisi
 * (inasaidia Android Chrome ambayo haiheshimu 100dvh vizuri kila wakati
 * keyboard inapofunguka).
 */
export function useVisualViewportHeight() {
  useEffect(() => {
    const setHeight = () => {
      const vv = window.visualViewport;
      const h = vv ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${h}px`);
    };

    setHeight();
    window.visualViewport?.addEventListener("resize", setHeight);
    window.visualViewport?.addEventListener("scroll", setHeight);
    window.addEventListener("resize", setHeight);

    return () => {
      window.visualViewport?.removeEventListener("resize", setHeight);
      window.visualViewport?.removeEventListener("scroll", setHeight);
      window.removeEventListener("resize", setHeight);
    };
  }, []);
}
