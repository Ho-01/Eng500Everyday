// WordbookPlayground.tsx
import React from "react";
import WordbookUploader, { type Wordbook } from "./WordbookUploader";
import WordbookQuiz from "./WordbookQuiz";
import WordbookView from "./WordbookView";
import ScoreBoard from "./ScoreBoard";
import { ScoreStorage } from "../storage/scoreStorage";
import ThemeToggle from "./ThemeToggle";

const WordbookPlayground: React.FC = () => {
  const [wb, setWb] = React.useState<Wordbook | null>(null); // 문제풀기 버튼이 눌린 단어장
  const [open, setOpen] = React.useState(false); // 퀴즈 모달 열림 상태
  const [isDetail, setIsDetail] = React.useState(false); // 단어장 상세보기 모드인지 여부

  return (
    <div className="mx-auto max-w-md px-4 pb-4 pt-0">
      <header className="sticky top-0 z-10 -mx-4 mb-4
             px-4 pt-4 pb-3
             bg-black/80 text-white/90
             backdrop-blur supports-[backdrop-filter]:bg-black/60">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">매일500영단어</h1>
            <p className="text-sm opacity-80 mt-1">매일 영단어공부 화이팅!</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* [변경] 상세보기 상태가 아닐 때만 스코어보드 표시 */}
      {!isDetail && <ScoreBoard /* globalRank={null} (백엔드 연동 시 주입) */ />}

      <WordbookView
        onDetailChange={setIsDetail}
        onStartQuiz={(book) => { setWb(book); setOpen(true); }}
      />

      {!isDetail && !open && (
        <div>
            <WordbookUploader onParsed={setWb} />
        </div>
      )}

      {open && wb && (
        <div>
            <WordbookQuiz
              wordbook={wb}
              secondsPerQuestion={5}
              onExit={() => setOpen(false)}
              onFinished={(percent, correct) => ScoreStorage.awardQuiz(percent, correct)}
            />
        </div>
      )}
    </div>
  );
};

export default WordbookPlayground;
