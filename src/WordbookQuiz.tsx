import React, { useEffect, useMemo, useState } from "react";

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

export type WordbookQuizProps = {
  /** 퀴즈에 사용할 단어장 */
  wordbook: Wordbook;
  /** 문제당 제한 시간(초). 기본 5초 */
  secondsPerQuestion?: number;
  /** 전체 문제 수 제한 (설정 시 무작위로 샘플링) */
  maxQuestions?: number;
  /** 퀴즈 종료 버튼/오버레이에서 호출 */
  onExit?: () => void;
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
}) => {
  const QUESTION_TIME_MS = Math.max(1, secondsPerQuestion) * 1000;

  const quizItems = useMemo(() => buildQuizItems(wordbook.items, maxQuestions), [wordbook, maxQuestions]);

  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState(QUESTION_TIME_MS);
  const [finished, setFinished] = useState(false);

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
  };

  const restart = () => {
    setIdx(0);
    setScore(0);
    setSelected(null);
    setTimeLeftMs(QUESTION_TIME_MS);
    setFinished(false);
  };

  const progress = Math.round((timeLeftMs / QUESTION_TIME_MS) * 100);

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
                  : isCorrect
                  ? "border-green-600"
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
          <div className="absolute inset-0 bg-white/95 backdrop-blur flex items-center justify-center p-6">
            <div className="w-full max-w-sm border rounded-2xl p-6 text-center">
              <div className="text-3xl font-bold">{Math.round((score / total) * 100)}%</div>
              <div className="mt-1 text-sm opacity-70">{total}문제 중 {score}개 정답</div>
              <div className="flex gap-2 mt-6 justify-center">
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

