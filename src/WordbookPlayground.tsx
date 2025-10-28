// WordbookPlayground.tsx
import React from "react";
import WordbookUploader, { type Wordbook } from "./WordbookUploader";
import WordbookQuiz from "./WordbookQuiz";
import WordbookView from "./WordbookView";
import ScoreBoard from "./ScoreBoard";
import { ScoreStorage } from "./storage/scoreStorage";

const WordbookPlayground: React.FC = () => {
  const [wb, setWb] = React.useState<Wordbook | null>(null);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="mx-auto max-w-md p-4 ">
      <header className="sticky top-0 z-10 -mx-4 mb-4 bg-black/70 backdrop-blur supports-[backdrop-filter]:bg-black/40 px-4 pt-4 pb-3 text-white">
        <h1 className="text-xl font-semibold">매일500영단어</h1>
        <p className="text-sm opacity-80 mt-1">매일 영단어공부 화이팅!</p>
      </header>

      <ScoreBoard /* globalRank={null} (백엔드 연동 시 주입) */ />

      <WordbookView
        onStartQuiz={(book) => { setWb(book); setOpen(true); }}
      />
      {!open && (
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
