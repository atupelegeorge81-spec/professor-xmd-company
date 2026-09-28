import { memo } from "react";

export type SpiralLoaderProps = {
  size?: number;
  className?: string;
};

export const SpiralLoader = memo(function SpiralLoader({
  size = 16,
  className = "",
}: SpiralLoaderProps) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="40 16"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
});
