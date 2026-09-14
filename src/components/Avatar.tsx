import { useState } from "react";
import type { Agent } from "@/lib/agents";

interface Props {
  agent?: Agent;
  size?: number;
  live?: boolean;
  className?: string;
}

/**
 * Crisp, never-blurry agent avatar.
 * - fixed square box (no aspect distortion)
 * - object-fit cover + GPU-stable transform
 * - intrinsic width/height so the browser decodes at the right scale
 * - emoji fallback when the image is missing or fails to load
 */
export function Avatar({ agent, size = 36, live = false, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const src = agent?.avatar;
  const px = `${size}px`;

  return (
    <span
      className={`avatar-frame ${live ? "xmd-avatar-glow" : ""} ${className}`}
      style={{ width: px, height: px, minWidth: px, minHeight: px }}
      aria-hidden={!agent}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={agent?.name ?? ""}
          width={size * 2}
          height={size * 2}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="avatar-img"
        />
      ) : (
        <span style={{ fontSize: Math.round(size * 0.5) }}>{agent?.emoji ?? "🤖"}</span>
      )}
    </span>
  );
}
