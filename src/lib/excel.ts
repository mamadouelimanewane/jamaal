import ExcelJS from "exceljs";

export interface ExcelSheet {
  name: string;
  columns: { header: string; key: string; width?: number }[];
  rows: Record<string, unknown>[];
}

export async function buildWorkbook(sheets: ExcelSheet[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "JAMAAL Back-office";
  workbook.created = new Date();

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31));
    ws.columns = sheet.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16233A" } };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.addRows(sheet.rows);
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function excelResponse(filename: string, sheets: ExcelSheet[]): Promise<Response> {
  const buffer = await buildWorkbook(sheets);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
