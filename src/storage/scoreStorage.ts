// src/storage/scoreStorage.ts
import { useSyncExternalStore } from "react";

type ScoreState = {
  score: number;
  lastAttendance: string | null; // YYYY-MM-DD
};

const SCORE_KEY = "m500:score:v1";
let state: ScoreState = load();
const listeners = new Set<() => void>();

function load(): ScoreState {
  try {
    const raw = localStorage.getItem(SCORE_KEY);
    if (!raw) return { score: 0, lastAttendance: null };
    const parsed = JSON.parse(raw);
    return {
      score: typeof parsed.score === "number" ? parsed.score : 0,
      lastAttendance: parsed.lastAttendance ?? null,
    };
  } catch {
    return { score: 0, lastAttendance: null };
  }
}
function save(s: ScoreState) {
  try {
    localStorage.setItem(SCORE_KEY, JSON.stringify(s));
  } catch {}
}
function emit() {
  save(state);
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot() {
  return state;
}
function todayKey() {
  // 로컬 날짜 YYYY-MM-DD (예: 2025-10-28)
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 점수 → 티어 계산
export type TierInfo = {
  label: string;            // 예: "브론즈3", "마스터 2단계", "챌린저 5등"
  baseLabel: string;        // 점수 기반 기본 티어 (챌린저/그마 제외)
  colorClass: string;       // Tailwind gradient 클래스
  nextAt: number | null;    // 다음 티어까지 남은 점수 (마스터는 100점 단위)
};

function tierColor(base: string): string {
  switch (base) {
    case "브론즈": return "from-amber-800 to-yellow-700";
    case "실버": return "from-zinc-300 to-zinc-500";
    case "골드": return "from-yellow-300 to-yellow-500";
    case "플래티넘": return "from-teal-400 to-emerald-500";
    case "다이아몬드": return "from-sky-400 to-blue-600";
    case "마스터": return "from-violet-500 to-fuchsia-600";
    case "그랜드마스터": return "from-rose-900 to-red-700";
    case "챌린저": return "from-yellow-400 to-sky-500";
    default: return "from-gray-300 to-gray-500";
  }
}

function tierByScore(score: number): { baseLabel: string; detail: string; nextAt: number | null } {
  // 0~100: 브론즈3, 100~200: 브론즈2, ... 1400~1500: 다이아1, 1500~: 마스터 N단계(100점마다)
  const bands = [
    { max: 100, base: "브론즈", sub: "3" },
    { max: 200, base: "브론즈", sub: "2" },
    { max: 300, base: "브론즈", sub: "1" },
    { max: 400, base: "실버", sub: "3" },
    { max: 500, base: "실버", sub: "2" },
    { max: 600, base: "실버", sub: "1" },
    { max: 700, base: "골드", sub: "3" },
    { max: 800, base: "골드", sub: "2" },
    { max: 900, base: "골드", sub: "1" },
    { max: 1000, base: "플래티넘", sub: "3" },
    { max: 1100, base: "플래티넘", sub: "2" },
    { max: 1200, base: "플래티넘", sub: "1" },
    { max: 1300, base: "다이아몬드", sub: "3" },
    { max: 1400, base: "다이아몬드", sub: "2" },
    { max: 1500, base: "다이아몬드", sub: "1" },
  ];
  for (const b of bands) {
    if (score < b.max) return { baseLabel: b.base, detail: `${b.base}${b.sub}`, nextAt: b.max - score };
  }
  // 1500 이상: 마스터 N단계 (100점마다 1단계)
  const over = score - 1500;
  const stage = Math.floor(over / 100) + 1;
  const remainder = 100 - (over % 100 || 0);
  return { baseLabel: "마스터", detail: `마스터 ${stage}단계`, nextAt: remainder === 100 ? 100 : remainder };
}

export function computeTier(score: number, globalRank?: number | null): TierInfo {
  const base = tierByScore(score);
  let label = base.detail;
  let baseLabel = base.baseLabel;
  let color = tierColor(baseLabel);

  if (typeof globalRank === "number" && globalRank > 0) {
    if (globalRank <= 10) {
      label = `챌린저 ${globalRank}등`;
      baseLabel = "챌린저";
      color = tierColor("챌린저");
    } else if (globalRank <= 100) {
      label = `그랜드마스터 ${globalRank}등`;
      baseLabel = "그랜드마스터";
      color = tierColor("그랜드마스터");
    }
  }
  return { label, baseLabel, colorClass: `bg-gradient-to-r ${color}`, nextAt: base.nextAt };
}

export const ScoreStorage = {
  useScore() {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  },

  getTier(globalRank?: number | null): TierInfo {
    return computeTier(state.score, globalRank);
  },

  // 출석: 하루 1회만 +20
  attendToday(): boolean {
    const today = todayKey();
    if (state.lastAttendance === today) return false;
    state = { ...state, score: state.score + 20, lastAttendance: today };
    emit();
    return true;
  },

  // 퀴즈 보상: 완료 시 +50, 정답률 보너스(0~10: +1, ... 90~100: +10), 맞춘 개수 1개당 +1
  awardQuiz(percent: number, correct: number = 0) {
    const bonus = Math.max(1, Math.min(10, Math.ceil(percent / 10))); // 0→1, 100→10
    const correctBonus = Math.max(0, Math.floor(correct));
    state = { ...state, score: state.score + 50 + bonus + correctBonus };
    emit();
  },

  // (디버그) 초기화
  reset() {
    state = { score: 0, lastAttendance: null };
    emit();
  },
};
