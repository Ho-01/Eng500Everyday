import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { AccuracyStorage } from "../storage/accuracyStorage";

/**
 * 단어장별 정답률 추이 그래프 (데이터 조회 + 렌더링 통합 버전)
 */
const WordbookAccuracyChart: React.FC<{ wordbookId: string }> = ({ wordbookId }) => {
  const records = AccuracyStorage.useRecords(wordbookId);
  const data = records.map((r) => ({
    attempt: r.attempt,
    accuracy: r.accuracy,
  }));

  if (data.length === 0) {
    return (
      <div className="text-center text-sm text-gray-400 my-2">
        아직 기록이 없어요 😺
      </div>
    );
  }

  return (
    <div className="w-full h-40 my-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data.slice(-10)} // 최근 10회만 표시
          margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.2} />
          <XAxis
            dataKey="attempt"
            tick={{ fill: "#aaa", fontSize: 10 }}
            label={{
              value: "완주 회차",
              position: "insideBottomRight",
              offset: -5,
              style: { fontSize: 10, fill: "#777" },
            }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#aaa", fontSize: 10 }}
            label={{
              value: "정답률(%)",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 10, fill: "#777" },
            }}
          />
          <Tooltip
            formatter={(value: number) => `${value.toFixed(1)}%`}
            labelFormatter={(label) => `#${label}회차`}
            contentStyle={{
              backgroundColor: "#1a1a1a",
              border: "none",
              color: "#fff",
            }}
          />
          <Line
            type="monotone"
            dataKey="accuracy"
            stroke="#82ca9d"
            strokeWidth={2}
            dot={{ r: 4, stroke: "#fff", strokeWidth: 1 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WordbookAccuracyChart;
