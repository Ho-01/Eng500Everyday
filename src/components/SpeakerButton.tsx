// src/components/SpeakerButton.tsx
import React from "react";

type Props = {
  onClick: () => void;
  speaking?: boolean;
  className?: string;
  label?: string;
};

const SpeakerButton: React.FC<Props> = ({ onClick, speaking, className = "", label }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 hover:opacity-90 active:scale-[0.98] ${className}`}
    title="발음 다시 듣기"
    aria-label="발음 다시 듣기"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 10v4h4l5 4V6L7 10H3z" fill="currentColor" />
      <path d="M14 9.23v5.54c1.19-.69 2-1.97 2-3.27s-.81-2.58-2-3.27z" fill="currentColor" opacity=".7" />
      <path d="M16 5v2c2.76 1.14 4 3.32 4 6s-1.24 4.86-4 6v2c4-1.2 6-4.28 6-8s-2-6.8-6-8z" fill="currentColor" opacity=".5" />
    </svg>
    발음 듣기
    <span className="hidden sm:inline">{label ?? (speaking ? "재생중…" : "다시 듣기")}</span>
  </button>
);

export default SpeakerButton;
