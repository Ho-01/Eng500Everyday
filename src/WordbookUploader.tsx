import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { WordbookStorage } from "./WordbookStorage";

// ==== Types ====
export type WordEntry = {
  term: string; // 영어 단어
  meaning: string; // 뜻(한글)
  note?: string; // 예문/메모 (선택)
};

export type Wordbook = {
  name: string;
  items: WordEntry[];
};

type Props = { onParsed?: (wb: Wordbook) => void };

// ==== Helpers ====
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replaceAll(" ", "")
    .replaceAll("_", "")
    .replaceAll("-", "");

const headerMap: Record<"term" | "meaning" | "note", string[]> = {
  term: [
    "word",
    "term",
    "english",
    "eng",
    "단어",
    "영어",
    "표제어",
  ],
  meaning: [
    "meaning",
    "뜻",
    "korean",
    "kor",
    "ko",
    "한글뜻",
    "해석",
    "의미",
  ],
  note: ["note", "예문", "example", "ex", "memo", "메모"],
};

function findHeaderKey(availableKeys: string[], candidates: string[]): string | null {
  const normalized = availableKeys.map((k) => ({ raw: k, norm: normalize(k) }));
  for (const cand of candidates) {
    const normCand = normalize(cand);
    const hit = normalized.find((k) => k.norm === normCand);
    if (hit) return hit.raw;
  }
  // 부분 일치 보완 (e.g., "한글 뜻" ↔ "한글뜻")
  for (const cand of candidates) {
    const normCand = normalize(cand);
    const hit = normalized.find((k) => k.norm.includes(normCand) || normCand.includes(k.norm));
    if (hit) return hit.raw;
  }
  return null;
}

function getFileNameWithoutExt(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
}

// ==== Component ====
const WordbookUploader: React.FC<Props> = ({ onParsed }) => {
  const [wordbook, setWordbook] = useState<Wordbook | null>(null);
  const [query, setQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    if (!wordbook) return [] as WordEntry[];
    const q = query.trim().toLowerCase();
    if (!q) return wordbook.items;
    return wordbook.items.filter(
      (w) => w.term.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q) || (w.note ?? "").toLowerCase().includes(q)
    );
  }, [wordbook, query]);

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    try {
      setErrorMsg(null);
      const file = e.target.files?.[0];
      if (!file) return;

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const firstSheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[firstSheetName];
      if (!sheet) throw new Error("시트를 찾을 수 없어요");

      // Sheet → JSON (헤더 자동 인식)
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: "",
        raw: true,
      });

      if (rows.length === 0) throw new Error("엑셀에 데이터가 없어요");

      // 헤더 키 후보 찾기
      const keys = Object.keys(rows[0] ?? {});
      const termKey = findHeaderKey(keys, headerMap.term);
      const meaningKey = findHeaderKey(keys, headerMap.meaning);
      const noteKey = findHeaderKey(keys, headerMap.note);

      if (!termKey || !meaningKey) {
        throw new Error(
          "필수 컬럼을 찾을 수 없어요. '단어/word/english' 와 '뜻/meaning/korean' 같은 헤더가 필요해요."
        );
      }

      const items: WordEntry[] = rows
        .map((r) => ({
          term: String(r[termKey] ?? "").trim(),
          meaning: String(r[meaningKey] ?? "").trim(),
          note: noteKey ? String(r[noteKey] ?? "").trim() : undefined,
        }))
        .filter((r) => r.term && r.meaning);

      if (items.length === 0) throw new Error("유효한 행이 없어요 (빈 값 제거 후 0건)");

      setWordbook({ name: getFileNameWithoutExt(file.name), items });
      onParsed?.({ name: getFileNameWithoutExt(file.name), items });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message ?? "업로드 처리 중 오류가 발생했어요");
      setWordbook(null);
    } finally {
      // 같은 파일 재업로드 가능하도록 리셋
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleReset = () => {
    setWordbook(null);
    setQuery("");
    setErrorMsg(null);
  };

  const handleWordbookSave = (wb: Wordbook) => {
    WordbookStorage.addWordbook({ name: wb.name, items: wb.items });
    setWordbook(null);
    alert(`단어장 "${wb.name}"이(가) 저장되었습니다! (기능 미구현)`);
  };

  return (
    <div className="mt-6 mb-20">
      <h2 className="text-lg font-semibold mb-3">단어장 업로드</h2>

      {/* 업로드 영역 */}
      {!wordbook && (
        <label
          htmlFor="file"
          className="block border-2 border-dashed rounded-2xl p-6 text-center text-sm cursor-pointer active:scale-[0.99] select-none"
        >
          <div className="mb-2 font-medium">엑셀 파일 업로드</div>
          <div className="opacity-70">터치해서 선택하거나, 드래그해서 올려도 돼요</div>
          <input
            id="file"
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>
      )}

      {errorMsg && (
        <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-red-700 text-sm">
          {errorMsg}
          <ul className="list-disc pl-5 mt-2">
            <li>헤더 예시: <code>단어</code> / <code>word</code> / <code>english</code></li>
            <li>헤더 예시: <code>뜻</code> / <code>meaning</code> / <code>korean</code></li>
            <li>선택: <code>예문</code> / <code>note</code></li>
          </ul>
        </div>
      )}

      {/* 단어장 표시 */}
      {wordbook && (
        <section className="mt-2">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-lg font-semibold">{wordbook.name}</h2>
              <p className="text-xs opacity-70">단어 개수 : {wordbook.items.length.toLocaleString()}개</p>              
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="text-xs px-3 py-2 rounded-full border active:scale-[0.98]"
              >
                업로드 취소
              </button>
              <button
                onClick={() => handleWordbookSave(wordbook)}
                className="text-xs px-3 py-2 rounded-full border bg-black text-white active:scale-[0.98]"
              >
                단어장 저장
              </button>
            </div>
          </div>

          <p className="text-xs mb-3">단어장 내용 확인 후 "단어장 저장" 버튼을 눌러 저장해요</p>

          <div className="mb-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="단어, 뜻, 메모 검색"
              className="w-full rounded-xl border px-4 py-3 text-sm"
            />
          </div>

          <ul className="space-y-2">
            {filtered.map((w, idx) => (
              <li key={`${w.term}-${idx}`} className="rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[10px] opacity-60 pt-1">{idx + 1}</span>
                  <div>
                    <div className="font-semibold text-base">{w.term}</div>
                    <div className="text-sm opacity-80 mt-0.5">{w.meaning}</div>
                    {w.note && (
                      <div className="text-xs mt-2 rounded-lg bg-gray-50 border px-3 py-2">{w.note}</div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {filtered.length === 0 && (
            <p className="text-center text-sm opacity-70 mt-6">검색 결과가 없어요</p>
          )}
        </section>
      )}

      {/* 하단 고정 가이드
      <footer className="fixed bottom-0 left-0 right-0 mx-auto max-w-md px-4 pb-6">
        <div className="rounded-2xl border bg-white p-3 text-[12px] shadow-lg">
          <div className="font-medium mb-1">엑셀 컬럼 안내</div>
          <div className="opacity-80">필수: <b>단어</b>(영어) / <b>뜻</b>(한글) · 선택: <b>예문</b> 또는 <b>메모</b></div>
        </div>
      </footer> */}
    </div>
  );
};

export default WordbookUploader;
