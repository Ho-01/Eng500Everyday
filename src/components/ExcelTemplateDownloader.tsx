import React from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button"; // shadcn/ui 버튼 예시 (없다면 일반 <button> 써도 됨)

const ExcelTemplateDownloader: React.FC = () => {
  const handleDownload = () => {
    // 1. 시트에 들어갈 예시 데이터
    const data = [
      ["영단어", "한글뜻"], // 헤더
      ["apple(예시1)", "사과(예시1)"],
      ["book(예시2)", "책(예시2)"],
      ["fish(예시3)", "물고기(예시3)"],
    ];

    // 2. 워크시트 & 워크북 생성
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    // 3. 엑셀 파일로 변환
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

    // 4. 파일 저장 (다운로드)
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "wordbook_template.xlsx");
  };

  return (
    <Button className="text-xs" onClick={handleDownload}>
      엑셀 양식 다운로드
    </Button>
  );
};

export default ExcelTemplateDownloader;
