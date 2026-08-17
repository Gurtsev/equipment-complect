import * as XLSX from 'xlsx';

type ExportRow = Record<string, unknown>;

export function exportEquipmentWorkbook(
  equipmentRows: ExportRow[],
  historyRows: ExportRow[],
  filename: string,
): void {
  const equipmentSheet = XLSX.utils.json_to_sheet(equipmentRows);
  equipmentSheet['!cols'] = [
    { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 14 },
    { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
  ];

  const historySheet = XLSX.utils.json_to_sheet(historyRows);
  historySheet['!cols'] = [
    { wch: 16 }, { wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 18 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, equipmentSheet, 'Оборудование');
  XLSX.utils.book_append_sheet(workbook, historySheet, 'История');
  XLSX.writeFile(workbook, filename);
}

export function exportProjectWorkbook(rows: ExportRow[], filename: string): void {
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 18 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Комплект');
  XLSX.writeFile(workbook, filename);
}
