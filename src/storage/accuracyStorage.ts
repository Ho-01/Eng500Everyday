import { useSyncExternalStore } from "react";

export type AccuracyRecord = {
  attempt: number;  // n번째 완주
  accuracy: number; // 0~100 (%)
  correct: number;  // 맞춘 개수
  date: string;     // YYYY-MM-DD
};

type AccuracyState = {
  [bookId: string]: AccuracyRecord[];
};

const KEY = "m500:accuracy:v2"; // v2로 버전 분리
let state: AccuracyState = load();
const listeners = new Set<() => void>();

function load(): AccuracyState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

function emit() {
  save();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return state;
}

export const AccuracyStorage = {
  /** 특정 단어장의 이력 구독 */
  useRecords(bookId: string): AccuracyRecord[] {
    return useSyncExternalStore(
      subscribe,
      () => state[bookId] ?? [],
      () => state[bookId] ?? []
    );
  },

  /** 회차 기록 추가 */
  addRecord(bookId: string, percent: number, correct: number) {
    const today = new Date().toISOString().slice(0, 10);
    const records = state[bookId] ?? [];
    const next: AccuracyRecord = {
      attempt: records.length + 1,
      accuracy: percent,
      correct,
      date: today,
    };
    // 최신 50개까지만 보존
    state = {
      ...state,
      [bookId]: [...records, next].slice(-50),
    };
    emit();
  },

  /** 특정 단어장 이력 초기화 */
  resetBook(bookId: string) {
    if (!state[bookId]) return;
    const copy = { ...state };
    delete copy[bookId];
    state = copy;
    emit();
  },

  /** 전체 초기화 (디버그용) */
  resetAll() {
    state = {};
    emit();
  },
};
