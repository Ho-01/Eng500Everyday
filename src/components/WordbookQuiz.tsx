import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScoreStorage, computeTier } from "../storage/scoreStorage";
import { usePronounce } from "../hooks/usePronounce";
import SpeakerButton from "./SpeakerButton";
import { WordbookStorage, type QuizResultItem } from "../storage/wordbookStorage";
import { type Wordbook, type WordEntry } from "../storage/wordbookStorage";
import WordbookAccuracyChart from "./WordbookAccuracyChart";
import { AccuracyStorage } from "../storage/accuracyStorage";

export type WordbookQuizProps = {
  wordbook: Wordbook;
  secondsPerQuestion?: number;
  maxQuestions?: number;
  onExit?: () => void;
  onFinished?: (percent: number, correct: number) => void;
};

export type QuizItem = {
  term: string;
  correct: string;
  options: string[];
};

// ===== 유틸 =====
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}
function buildQuizItems(items: WordEntry[], limit?: number): QuizItem[] {
  const uniqueMeanings = Array.from(new Set(items.map((i) => i.meaning))).filter(Boolean);
  if (uniqueMeanings.length < 4) {
    throw new Error("서로 다른 한글 뜻이 최소 4개 이상이어야 4지선다 보기를 만들 수 있어요.");
  }
  const pool = limit ? sample(items, Math.min(limit, items.length)) : items.slice();
  return pool.map<QuizItem>((w) => {
    const distractors = sample(uniqueMeanings.filter((m) => m !== w.meaning), 3);
    const options = shuffle([w.meaning, ...distractors]);
    return { term: w.term, correct: w.meaning, options };
  });
}

// ===== 컴포넌트 =====
const WordbookQuiz: React.FC<WordbookQuizProps> = ({
  wordbook,
  secondsPerQuestion = 5,
  maxQuestions,
  onExit,
  onFinished,
}) => {
  const QUESTION_TIME_MS = Math.max(1, secondsPerQuestion) * 1000;
  const quizItems = useMemo(() => buildQuizItems(wordbook.items, maxQuestions), [wordbook, maxQuestions]);

  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState(QUESTION_TIME_MS);
  const [finished, setFinished] = useState(false);

  // 누적 점수(현재) & 완료 시점 점수 스냅샷 (미니 티어 카드용)
  const { score: baseScore } = ScoreStorage.useScore();
  const [baseAtFinish, setBaseAtFinish] = useState<number | null>(null);

  const { supports, isSpeaking, speak, cancel, autoOnce, resetAuto } = usePronounce("en-US", 0.95);

  // (완료 시 일괄 반영할) 이번 회차 결과 버퍼
  const resultsRef = useRef<{ term: string; isCorrect: boolean }[]>([]);

  // [FIX] 현재 문제 안전 접근: finished면 사용 금지
  const total = quizItems.length;
  const hasCurrent = !finished && idx < total; // [ADD] 안전 가드
  const current = hasCurrent ? quizItems[idx] : null; // [FIX]

  // 타이머
  useEffect(() => {
    if (!hasCurrent) return; // [FIX] finished 상태에서는 타이머 시작 안 함
    setSelected(null);
    setTimeLeftMs(QUESTION_TIME_MS);
    let start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, QUESTION_TIME_MS - elapsed);
      setTimeLeftMs(left);
      if (left <= 0) {
        clearInterval(id);
        resultsRef.current.push({ term: quizItems[idx].term, isCorrect: false });
        setTimeout(() => next(null), 40);
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, QUESTION_TIME_MS, quizItems, hasCurrent]); // [FIX] hasCurrent 의존성 추가

  // 자동 1회 발음
  useEffect(() => {
    if (!supports || finished) return;
    const item = quizItems[idx];
    if (item?.term) autoOnce(`q-${idx}`, item.term, 120);
  }, [idx, finished, supports, quizItems, autoOnce]);

  const choose = (optIndex: number) => {
    if (!hasCurrent || selected !== null) return; // [FIX] 안전 가드
    setSelected(optIndex);
    const ok = current!.options[optIndex] === current!.correct; // [SAFE] current! (위서 가드)
    if (ok) setScore((s) => s + 1);
    resultsRef.current.push({ term: current!.term, isCorrect: ok });
    setTimeout(() => next(optIndex), 350);
  };

  const next = (_optIndex: number | null) => {
    cancel();
    if (idx + 1 < total) setIdx((i) => i + 1);
    else setFinished(true);
  };

  const restart = () => {
    setIdx(0);
    setScore(0);
    setSelected(null);
    setTimeLeftMs(QUESTION_TIME_MS);
    setFinished(false);
    setBaseAtFinish(null);
    resetAuto();
    cancel();
    resultsRef.current = [];
  };

  // [FIX] 완료 시 1회만 반영 + 1회만 onFinished 호출
  useEffect(() => {
    if (!finished) return;
    console.log('[finish/check]', { id: wordbook?.id, items: resultsRef.current }); // ★ 디버그

    // 완료 시점 누적 점수 스냅샷 고정 (미니 티어 카드용)
    setBaseAtFinish((prev) => (prev ?? baseScore)); // [ADD]

    try {
      if (wordbook.id && resultsRef.current.length) { // 프롭으로 받은 bookId 사용
        console.log('[finish/apply] applying to bookId=', wordbook.id, 'wrongCountOf=', resultsRef.current.filter(r=>!r.isCorrect).length);
        WordbookStorage.applyResultsBatchWrongOnly(wordbook.id, resultsRef.current as QuizResultItem[]);
      }
    } finally {
      const correct = resultsRef.current.filter((r) => r.isCorrect).length;
      const percent = Math.round((correct / total) * 100);
      onFinished?.(percent, correct); // [FIX] onFinished는 여기서만 1회 호출
      resultsRef.current = [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  // 진행 바
  const progress = Math.round((timeLeftMs / QUESTION_TIME_MS) * 100);

  // 완료 화면용 보상 계산(프런트 프리뷰)
  const percent = Math.round((score / total) * 100);
  const completionPts = 20;
  const accuracyPts = Math.max(1, Math.min(10, Math.ceil(percent / 10)));
  const correctPts = score;
  const gainedTotal = completionPts + accuracyPts + correctPts;

  const previewBase = (baseAtFinish ?? baseScore);
  const previewScore = previewBase + gainedTotal;
  const previewTier = computeTier(previewScore, null);
  const prevTier = computeTier(previewBase, null);
  const promoted = prevTier.label !== previewTier.label;

  // [SIMPLIFY] nextAt을 퍼센트로 환산하는 대신, "남은 점수 텍스트 + 얇은 진행도" 조합 유지
  const progressText = previewTier.nextAt === null ? null : `다음 단계까지 ${previewTier.nextAt}점`;

  return (
    <div className="fixed inset-0 z-50 bg-white">
      <div className="mx-auto max-w-md h-full flex flex-col">
        {/* Top bar */}
        <header className="p-4 flex items-center justify-between border-b">
          <div className="text-sm opacity-70">Q {Math.min(idx + 1, total)}/{total}</div> {/* [FIX] 표기 가드 */}
          <div className="text-sm font-medium">점수 {score}</div>
          <button onClick={onExit} className="text-sm px-3 py-1 rounded-full border">종료</button>
        </header>

        {/* 본문(문제 영역) — 완료되면 렌더하지 않음 */}
        {!finished && hasCurrent && current && (  // [FIX] 가드 추가
          <>
            {/* Timer */}
            <div className="px-4 pt-3">
              <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full bg-black transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-[11px] opacity-60 mt-1">남은 시간 {Math.ceil(timeLeftMs / 1000)}초</div>
            </div>

            {/* Question */}
            <main className="px-4 py-6 flex-1 flex flex-col">
              <div className="text-2xl font-bold text-center break-words">{current.term}</div>
              {supports && (
                <div className="mt-3 flex justify-center">
                  <SpeakerButton onClick={() => speak(current.term)} speaking={isSpeaking} label="발음 듣기" />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                {current.options.map((opt, i) => {
                  const isPicked = selected === i;
                  const isCorrect = opt === current.correct;
                  const color =
                    selected === null
                      ? "border"
                      : isPicked && isCorrect
                      ? "border-green-600 bg-green-50"
                      : isPicked && !isCorrect
                      ? "border-red-600 bg-red-50"
                      : "border";
                  return (
                    <button
                      key={i}
                      onClick={() => choose(i)}
                      disabled={selected !== null}
                      className={`text-left rounded-2xl px-4 py-4 ${color}`}
                    >
                      <div className="text-sm leading-relaxed">{opt}</div>
                    </button>
                  );
                })}
              </div>
            </main>
          </>
        )}

        {/* 완료 오버레이 */}
        {finished && (
          <div className="absolute inset-0 bg-white backdrop-blur flex items-center justify-center p-6">
            <div className="w-full max-w-sm shadow-md border rounded-2xl p-6 space-y-4">
              {/* 결과 요약 */}
              <div className="text-center">
                <div className="text-3xl font-bold">오늘 영단어 공부 끝!</div>
                <div className="mt-3 text-xl font-bold">정답률 : {percent}%</div>
                <div className="mt-1 text-sm opacity-70">{total}문제 중 {score}개 정답</div>
              </div>

              {/* 획득 점수 상세 */}
              <div className="rounded-xl bg-gray-50 p-3">
                <div className="text-center text-lg font-bold">+{gainedTotal}점 획득</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
                  <div className="rounded-lg bg-white border border-gray-300 p-2 text-center">
                    <div className="font-semibold">완주</div>
                    <div className="mt-0.5">+{completionPts}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-gray-300 p-2 text-center">
                    <div className="font-semibold">정답률</div>
                    <div className="mt-0.5">+{accuracyPts}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-gray-300 p-2 text-center">
                    <div className="font-semibold">정답개수</div>
                    <div className="mt-0.5">+{correctPts}</div>
                  </div>
                </div>
              </div>

              {/* 단어장별 정답률 추이 그래프 */}
              <WordbookAccuracyChart wordbookId={wordbook.id} />

              {/* 미니 티어 카드 */}
              <div className={`rounded-xl border p-3 text-white/90 ${previewTier.colorClass}`}>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 font-semibold">
                    <span>{previewTier.label}</span>
                    {promoted && (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-200 text-black/90 font-semibold shadow animate-pulse"
                        title={`${prevTier.label} → ${previewTier.label}`}
                      >
                        승급했어요!
                      </span>
                    )}
                  </div>
                  <div className="opacity-90">누적 {previewScore.toLocaleString()}점</div>
                </div>
                <div className="mt-2">
                  <div className="h-1.5 rounded-full bg-white/30 overflow-hidden">
                    {/* [SIMPLIFY] 퍼센트 계산 대신 CSS width는 임시로 텍스트 기반 비율로 대체 가능 */}
                    <div className="h-full bg-white/90 transition-[width] duration-300" style={{ width: promoted ? "100%" : "70%" }} />
                  </div>
                  {progressText && (
                    <div className="mt-1 text-[11px] opacity-90">{progressText}</div>
                  )}
                </div>
              </div>

              {/* 버튼 */}
              <div className="flex gap-2 justify-center">
                <button onClick={restart} className="px-4 py-2 rounded-full border border-gray-500 font-medium">다시 풀기</button>
                <button onClick={onExit} className="px-4 py-2 rounded-full border bg-black text-white font-medium">끝내기</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WordbookQuiz;
