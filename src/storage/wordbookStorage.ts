// src/storage/wordbookStorage.ts
import { useSyncExternalStore } from "react";
import { DEFAULT_TOEIC_500 } from "../data/DefaultWordbookToeic500";

/** ===== Types (요청 포맷) ===== */
export type WordEntry = {
  term: string;
  meaning: string;
  wrongCount: number;
  note?: string;
};

export type Wordbook = {
  id: string;
  name: string;
  items: WordEntry[];
  createdAt: number;
};

/** ===== 내부 상태 & 유틸 ===== */
const STORAGE_KEY = "wordbooks:v1";
const DEFAULT_WORDBOOK_FLAG_KEY = "wordbooks:seeded:v1";

let state: Wordbook[] = load();
const listeners = new Set<() => void>();

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function load(): Wordbook[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw){
        if(!localStorage.getItem(DEFAULT_WORDBOOK_FLAG_KEY)){ // flag가 false면 기본 단어장 심기
            const seeded = [makeSeedBook()];
            localStorage.setItem(DEFAULT_WORDBOOK_FLAG_KEY, "true");
            localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
            return seeded;
        }
        return [];
    }
    const parsed = raw ? (JSON.parse(raw) as Wordbook[]) : [];
    // 타입 보정: wrongCount 누락 대비
    return parsed.map((wb) => ({
      ...wb,
      items: wb.items.map((item) => ({ ...item, wrongCount: item.wrongCount ?? 0 })),
    }));
  } catch {
    return [];
  }
}
function save(next: Wordbook[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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

//기본 단어장 객체 생성 헬퍼
function makeSeedBook(): Wordbook {
  return {
    id: uid(),
    name: "TOEIC 500",
    createdAt: Date.now(),
    items: DEFAULT_TOEIC_500.map((i) => ({
      term: i.term,
      meaning: i.meaning,
      note: i.note,
      wrongCount: 0,
    })),
  };
}

/** ===== Public API (나중에 백엔드 연동 시 이 레이어만 교체) ===== */
export const WordbookStorage = {
  /** View에서 상태 구독 */
  useWordbooks(): Wordbook[] {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  },

  /** 업로더에서 저장 버튼 눌렀을 때 호출 (wrongCount 자동 0 세팅) */
  addWordbook(input: { name: string; items: Array<{ term: string; meaning: string; note?: string }> }) {
    const wb: Wordbook = {
      id: uid(),
      name: input.name,
      createdAt: Date.now(),
      items: input.items.map((i) => ({
        term: i.term,
        meaning: i.meaning,
        note: i.note,
        wrongCount: 0,
      })),
    };
    state = [wb, ...state]; // 최근 것이 위로
    emit();
    return wb.id;
  },

  rename(id: string, name: string) {
    state = state.map((b) => (b.id === id ? { ...b, name } : b));
    emit();
  },

  remove(id: string) {
    state = state.filter((b) => b.id !== id);
    emit();
  },

  /** 단어 추가 */
  addEntry(bookId: string, entry: { term: string; meaning: string; note?: string }) {
    state = state.map((b) =>
      b.id === bookId
        ? { ...b, items: [{ term: entry.term, meaning: entry.meaning, note: entry.note, wrongCount: 0 }, ...b.items] }
        : b
    );
    emit();
  },

  /** 단어 삭제 (index 기반) */
  removeEntry(bookId: string, index: number) {
    state = state.map((b) =>
      b.id === bookId ? { ...b, items: b.items.filter((_, i) => i !== index) } : b
    );
    emit();
  },

  /** 뷰어의 '최신화(서버)' 버튼에서 사용할 모의 함수 */
  async refreshFromBackendMock() {
    // 실제로는 서버 → 로컬 동기화
    console.log("[mock] 백엔드에서 최신 단어장 목록을 불러오는 중...");
    await new Promise((r) => setTimeout(r, 300));
    console.log("[mock] 최신화 완료(모의). 현재 개수:", state.length);
    // 필요하면 state = 서버데이터; emit();
  },
};

export type { WordEntry as TWordEntry, Wordbook as TWordbook };
