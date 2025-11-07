// src/components/WordbookView.tsx
import React, { useMemo, useState, useEffect } from "react";
import { WordbookStorage, type TWordbook } from "../storage/wordbookStorage";
import WordbookAccuracyChart from "./WordbookAccuracyChart";

// ✅ shadcn 컴포넌트들
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * 화면 구성
 * - 목록 보기: 모든 단어장(이름, 개수, 생성시기) + 이름변경 + 삭제
 * - 상세 보기: 선택한 단어장 단어 목록(영어/한글/누적오답/메모) + 단어 추가 + 단어 삭제 + 뒤로가기
 * - 수정(단어 편집)은 불가 요구사항에 맞춰 미제공
 */

// 퀴즈 시작을 위한 선택적 프롭 (최소 변경)
type Props = {
  onStartQuiz?: (wb: TWordbook) => void; // TWordbook 타입으로 전달
  onDetailChange?: (isDetail: boolean) => void; // 상세 보기 상태 통지
};

const WordbookView: React.FC<Props> = ({ onStartQuiz, onDetailChange }) => {
  const books = WordbookStorage.useWordbooks();

  // 화면 모드: 전체 단어장 목록 / 단어장 상세
  const [activeId, setActiveId] = useState<string | null>(null);

  // 목록 화면: 이름 변경
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // 상세 화면: 단어 추가 폼
  const [newTerm, setNewTerm] = useState("");
  const [newMeaning, setNewMeaning] = useState("");
  const [newNote, setNewNote] = useState("");

  // 상세화면 선택된 단어장
  const activeBook: TWordbook | undefined = useMemo(
    () => books.find((b) => b.id === activeId),
    [books, activeId]
  );

  // 상세 보기(isDetail) 상태가 바뀔 때마다 부모에 알려줌
  useEffect(() => {
    onDetailChange?.(Boolean(activeBook));
  }, [activeBook, onDetailChange]);

  // 퀴즈 시작 가능 여부 : 단어가 4개 이상인가?
  const canStartQuiz = (b: TWordbook) => new Set(b.items.map((i) => i.meaning)).size >= 4;

  /** 목록 화면 동작들 */
  const startRename = (b: TWordbook) => {
    setRenamingId(b.id);
    setRenameValue(b.name);
  };
  const commitRename = () => {
    if (!renamingId) return;
    const name = renameValue.trim();
    if (!name) return setRenamingId(null);
    WordbookStorage.rename(renamingId, name);
    setRenamingId(null);
  };
  const removeBook = (b: TWordbook) => {
    if (!confirm("이 단어장을 삭제할까요?")) return;
    WordbookStorage.remove(b.id);
    if (activeId === b.id) setActiveId(null);
  };

  /** 상세 화면 동작들 */
  const addEntry = () => {
    const term = newTerm.trim();
    const meaning = newMeaning.trim();
    if (!activeBook) return;
    if (!term || !meaning) return alert("영어/한글 뜻은 필수입니다.");
    WordbookStorage.addEntry(activeBook.id, { term, meaning, note: newNote.trim() || undefined });
    setNewTerm("");
    setNewMeaning("");
    setNewNote("");
  };
  const removeEntry = (index: number) => {
    if (!activeBook) return;
    if (!confirm("이 단어를 삭제할까요?")) return;
    WordbookStorage.removeEntry(activeBook.id, index);
  };

  /** === 목록 화면 === */
  if (!activeBook) {
    return (
      <section className="mt-6">
        <h2 className="text-lg font-semibold mb-3">단어장 목록</h2>

        <ul className="space-y-3">
          {books.map((b) => {
            const quizable = canStartQuiz(b);
            return (
              <li key={b.id} className="rounded-2xl border border-gray-300 shadow-md overflow-hidden bg-white">
                <div className="flex items-center justify-between gap-2 p-4">
                  {/* 이름/개수/생성시기 */}
                  <button onClick={() => setActiveId(b.id)} className="text-left flex-1">
                    {renamingId === b.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="w-full max-w-[70%] rounded-xl border px-3 py-2 text-sm"
                      />
                      <button onClick={commitRename} className="text-xs px-3 py-2 rounded-full border bg-black text-white">저장</button>
                      <button onClick={() => setRenamingId(null)} className="text-xs px-3 py-2 rounded-full border">취소</button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-base font-semibold flex items-center gap-2">
                        <span>{b.name}</span>
                      </div>
                      <div>
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 shadow-sm bg-neutral-50">
                          단어 개수 : {b.items.length.toLocaleString()}개
                        </span>
                      </div>
                      <div className="text-xs opacity-70 mt-3">{new Date(b.createdAt).toLocaleDateString()}</div>
                    </div>
                  )}
                </button>

                {/* 액션: 문제풀기/이름변경/삭제 */}
                {renamingId !== b.id && (
                  <div className="flex items-center gap-2">
                    <button
                        onClick={() => onStartQuiz?.(b)}
                        disabled={!quizable}
                        title={quizable ? "이 단어장으로 문제풀기" : "서로 다른 한글 뜻이 4개 이상 필요해요"}
                        className={`text-xs px-3 py-2 rounded-full border ${quizable ? "bg-black text-white" : "opacity-50"}`}
                    >
                        문제풀기
                    </button>
                    <button onClick={() => startRename(b)} className="text-xs px-3 py-2 rounded-full border border-gray-200 shadow-sm">이름변경</button>
                    <button onClick={() => removeBook(b)} className="text-xs px-3 py-2 rounded-full border border-gray-200 shadow-sm">삭제</button>
                  </div>
                )}
              </div>
            </li>
          )})}
        </ul>

        {books.length === 0 && (
          <p className="text-center text-sm opacity-70 mt-6">저장된 단어장이 없어요</p>
        )}
      </section>
    );
  }

  /** === 상세 화면 === */
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setActiveId(null)} className="text-xs px-3 py-2 rounded-full border border-gray-200 shadow-sm">← 뒤로가기</button>
        <div className="text-lg font-semibold opacity-70">{activeBook.name}</div>
      </div>

      {/* 단어장별 정답률 추이 그래프 */}
      <WordbookAccuracyChart wordbookId={activeBook.id} />

      {/* 단어 추가 폼 */}
      <div className="rounded-xl border border-gray-300 shadow-md p-3 mb-4">
        <div className="text-sm font-semibold mb-2">단어 추가</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            placeholder="영어(ex. apple)"
            className="rounded-lg border border-gray-200 shadow-sm px-3 py-2 text-sm"
          />
          <input
            value={newMeaning}
            onChange={(e) => setNewMeaning(e.target.value)}
            placeholder="한글 뜻(ex. 사과)"
            className="rounded-lg border border-gray-200 shadow-sm px-3 py-2 text-sm"
          />
          <input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="메모(선택)"
            className="rounded-lg border border-gray-200 shadow-sm px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-2">
          <button onClick={addEntry} className="text-xs px-3 py-2 rounded-full border bg-black text-white">추가</button>
        </div>
      </div>

      {/* 단어 목록 */}
      <ul className="space-y-2">
        {activeBook.items.map((w, idx) => (
          <li key={`${w.term}-${idx}`} className="rounded-xl border border-gray-300 shadow-md p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{w.term}</div>
                <div className="text-sm opacity-80 mt-0.5">{w.meaning}</div>
                {w.note && <div className="text-xs mt-2 rounded-lg bg-neutral-50 border px-3 py-2">{w.note}</div>}
                <div className="text-[11px] opacity-70 mt-1">누적 오답: {w.wrongCount}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] opacity-60 pt-1">#{idx + 1}</span>
                <button onClick={() => removeEntry(idx)} className="text-xs px-3 py-2 rounded-full border border-gray-200 shadow-sm">삭제</button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {activeBook.items.length === 0 && (
        <p className="text-center text-sm opacity-70 mt-6">단어가 아직 없어요. 위에서 추가해 보세요.</p>
      )}
    </section>
  );
};

export default WordbookView;
