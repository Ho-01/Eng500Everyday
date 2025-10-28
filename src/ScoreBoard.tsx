// src/components/ScoreBoard.tsx
import React from "react";
import { ScoreStorage, computeTier } from "./storage/scoreStorage";

type Props = {
  globalRank?: number | null; // 백엔드 연동 시 상위 10/100 처리용
};

const ScoreBoard: React.FC<Props> = ({ globalRank = null }) => {
  const { score, lastAttendance } = ScoreStorage.useScore();
  const tier = React.useMemo(() => computeTier(score, globalRank), [score, globalRank]);

  const progressPercent = React.useMemo(() => {
    if (tier.nextAt == null) return 100;
    const p = 100 - tier.nextAt; // 0~100
    return Math.max(0, Math.min(100, p));
  }, [tier.nextAt]);

  const attended = (() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return lastAttendance === `${y}-${m}-${d}`;
  })();

  return (
    <div className="mb-4">
      <div className={`rounded-2xl border p-4 text-white ${tier.colorClass}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-90">누적 점수</div>
            <div className="text-3xl font-extrabold tracking-tight">{score.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-90">현재 티어</div>
            <div className="text-xl font-bold">{tier.label}</div>
          </div>
        </div>

        {tier.nextAt !== null && (
          <div className="mt-3">
            {/* Progress Bar */}
            <div className="h-2 rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full bg-white transition-[width] duration-300"
                style={{ width: `${progressPercent}%` }}
                aria-hidden
              />
            </div>
            <div className="mt-3 text-[12px] opacity-90">
              다음 단계까지 <b>{tier.nextAt}</b>점
            </div>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => ScoreStorage.attendToday()}
            disabled={attended}
            className={`text-xs px-3 py-2 rounded-full border ${
              attended ? "opacity-60 cursor-not-allowed bg-white/10" : "bg-white/15 hover:bg-white/20"
            }`}
            title={attended ? "오늘은 이미 출석했어요" : "오늘 출석하고 +20점"}
          >
            {attended ? "오늘 출석 완료" : "출석하기 +20"}
          </button>
          {/* 디버그용: 필요 시 주석 해제
          <button onClick={() => ScoreStorage.reset()} className="text-xs px-3 py-2 rounded-full border bg-white/15">
            점수 초기화
          </button>
          */}
        </div>
      </div>
    </div>
  );
};

export default ScoreBoard;
