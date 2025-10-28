import React, { useEffect, useMemo, useState } from "react";
import { ScoreStorage, computeTier } from "../storage/scoreStorage";
import { usePronounce } from "../hooks/usePronounce";
import SpeakerButton from "./SpeakerButton";

// ===== 타입 =====
export type WordEntry = {
  term: string;      // 영어 단어
  meaning: string;   // 한글 뜻
  note?: string;     // 예문/메모 (선택)
};

export type Wordbook = {
  name: string;
  items: WordEntry[];
};

// onFinished가 (percent, correct)을 받도록 확장되어 있어야 함
export type WordbookQuizProps = {
  /** 퀴즈에 사용할 단어장 */
  wordbook: Wordbook;
  /** 문제당 제한 시간(초). 기본 5초 */
  secondsPerQuestion?: number;
  /** 전체 문제 수 제한 (설정 시 무작위로 샘플링) */
  maxQuestions?: number;
  /** 퀴즈 종료 버튼/오버레이에서 호출 */
  onExit?: () => void;
  /** 퀴즈 종료 시 (정답률, 맞춘개수) 전달 */
  onFinished?: (percent: number, correct: number) => void; // [변경]
};

export type QuizItem = {
  term: string;         // 영어 단어
  correct: string;      // 정답(한글 뜻)
  options: string[];    // 보기 4개(정답 + 오답3)
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

// ===== 퀴즈 컴포넌트 =====
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

  // 현재 누적 점수(스토어)와, "완료 시점의 베이스 점수"를 스냅샷으로 고정
  const { score: baseScore } = ScoreStorage.useScore();         // 실시간 누적 점수
  const [baseAtFinish, setBaseAtFinish] = useState<number | null>(null); // 완료 순간의 누적 점수 스냅샷

  const { supports, isSpeaking, speak, cancel, autoOnce, resetAuto } = usePronounce("en-US", 0.95);

  // 문제 전환 시 타이머 리셋
  useEffect(() => {
    setSelected(null);
    setTimeLeftMs(QUESTION_TIME_MS);
    let start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, QUESTION_TIME_MS - elapsed);
      setTimeLeftMs(left);
      if (left <= 0) {
        clearInterval(id);
        setTimeout(() => next(null), 40);
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, QUESTION_TIME_MS]);

  // 문제 바뀔 때 자동 1회 발음
  useEffect(() => {
    if (!supports || finished) return;
    const current = quizItems[idx];
    if (current?.term) autoOnce(`q-${idx}`, current.term, 120);
  }, [idx, finished, supports, quizItems, autoOnce]);

  const total = quizItems.length;
  const current = quizItems[idx];

  const choose = (optIndex: number) => {
    if (selected !== null) return;
    setSelected(optIndex);
    const isCorrect = current.options[optIndex] === current.correct;
    if (isCorrect) setScore((s) => s + 1);
    setTimeout(() => next(optIndex), 350);
  };

  const next = (_optIndex: number | null) => {
    if (idx + 1 < total) setIdx((i) => i + 1);
    else setFinished(true);
    cancel(); // 다음 문제로 넘어갈 때 겹침 방지
  };

  const restart = () => {
    setIdx(0);
    setScore(0);
    setSelected(null);
    setTimeLeftMs(QUESTION_TIME_MS);
    setFinished(false);
    setBaseAtFinish(null); // 리셋 시 스냅샷도 초기화
    resetAuto();
    cancel();
  };

  // 완료되면 1회만 (정답률, 맞춘개수) 전달 + 베이스 점수 스냅샷 고정
  useEffect(() => {
    if (!finished) return;
    const percent = Math.round((score / total) * 100);
    setBaseAtFinish((prev) => (prev ?? baseScore)); // 처음 완료될 때의 누적 점수 고정
    onFinished?.(percent, score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const progress = Math.round((timeLeftMs / QUESTION_TIME_MS) * 100);

  // 완료 화면에서 사용할 "획득 점수 구성" 계산 (스토리지 규칙과 동일)
  const percent = Math.round((score / total) * 100);
  const completionPts = 20; // 완주 보상
  const accuracyPts = Math.max(1, Math.min(10, Math.ceil(percent / 10))); // 0~10:+1 ... 90~100:+10
  const correctPts = score; // 맞춘 개수만큼
  const gainedTotal = completionPts + accuracyPts + correctPts;

  // 완료 시점의 누적 점수 스냅샷 + 예상 증가분으로 "예상 최종 티어" 미리 계산
  const previewBase = baseAtFinish ?? baseScore;          // 완료 직전 점수
  const previewScore = previewBase + gainedTotal;         // 완료 후 예상 누적
  const previewTier = computeTier(previewScore, null);    // 랭킹 미사용(null)

   // 직전 티어(완료 전) 계산 + 승급 여부
  const prevTier = computeTier(previewBase, null);        // 완료 전 티어
  const promoted = prevTier.label !== previewTier.label;  // 승급 여부

  const previewProgressPercent = previewTier.nextAt == null
    ? 100
    : Math.max(0, Math.min(100, 100 - previewTier.nextAt)); // [추가] 미니 진행도

  return (
    <div className="fixed inset-0 z-50 bg-white">
      <div className="mx-auto max-w-md h-full flex flex-col">
        {/* Top bar */}
        <header className="p-4 flex items-center justify-between border-b">
          <div className="text-sm opacity-70">Q {idx + 1}/{total}</div>
          <div className="text-sm font-medium">점수 {score}</div>
          <button onClick={onExit} className="text-sm px-3 py-1 rounded-full border">종료</button>
        </header>

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
             <SpeakerButton onClick={() => speak(quizItems[idx].term)} speaking={isSpeaking} label="발음 듣기" />
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

        {/* Finished overlay */}
        {finished && (
          <div className="absolute inset-0 bg-white backdrop-blur flex items-center justify-center p-6">
            <div className="w-full max-w-sm border rounded-2xl p-6 space-y-4">
              {/* 결과 요약 */}
              <div className="text-center">
                <div className="text-3xl font-bold">오늘 영단어 공부 끝!</div>
                <div className="mt-3 text-xl font-bold">정답률 : {percent}%</div>
                <div className="mt-1 text-sm opacity-70">{total}문제 중 {score}개 정답</div>
              </div>

              {/* [추가] 획득 점수 + 상세 구성 */}
              <div className="rounded-xl bg-gray-50">
                <div className="text-center text-lg font-bold">+{gainedTotal}점 획득</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
                  <div className="rounded-lg bg-white border border-gray-400 p-2 text-center">
                    <div className="font-semibold">완주</div>
                    <div className="mt-0.5">+{completionPts}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-gray-400 p-2 text-center">
                    <div className="font-semibold">정답률</div>
                    <div className="mt-0.5">+{accuracyPts}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-gray-400 p-2 text-center">
                    <div className="font-semibold">정답개수</div>
                    <div className="mt-0.5">+{correctPts}</div>
                  </div>
                </div>
              </div>

              {/* 미니 티어 카드 */}
              <div className={`rounded-xl border p-3 text-white/90 ${previewTier.colorClass}`}>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 font-semibold">
                    <span>{previewTier.label}</span>
                    {promoted && (
                        <span
                            className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-200 text-black/90 font-semibold shadow animate-pulse" // [추가]
                        title={`${prevTier.label} → ${previewTier.label}`} // 승급뱃지
                        >
                            승급했어요!
                        </span>
                    )}
                  </div>
                  <div className="opacity-90">누적 {previewScore.toLocaleString()}점</div>
                </div>
                <div className="mt-2">
                  <div className="h-1.5 rounded-full bg-white/30 overflow-hidden">
                    <div
                      className="h-full bg-white/90 transition-[width] duration-300"
                      style={{ width: `${previewProgressPercent}%` }}
                      aria-hidden
                    />
                  </div>
                  {previewTier.nextAt !== null && (
                    <div className="mt-1 text-[11px] opacity-90">
                      다음 단계까지 <b>{previewTier.nextAt}</b>점
                    </div>
                  )}
                </div>
              </div>

              {/* 버튼들 */}
              <div className="flex gap-2 justify-center">
                <button onClick={restart} className="px-4 py-2 rounded-full border font-medium">다시 풀기</button>
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
