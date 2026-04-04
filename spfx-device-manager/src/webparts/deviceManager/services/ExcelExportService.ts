import * as XLSX from 'xlsx';
import { IEmployeeView } from '../models/IModels';

// ============================================================
// Excelエクスポートサービス (SheetJS)
// ============================================================

export class ExcelExportService {

  // 社員台帳（割当情報込み）をExcel出力
  public static exportEmployeeList(employees: IEmployeeView[]): void {
    const rows: any[] = [];
    for (const emp of employees) {
      if (emp.allocations.length === 0) {
        rows.push({
          '従業員番号': emp.Title,
          '氏名': emp.EmployeeName,
          '部署': emp.Department,
          '役職': emp.JobTitle,
          '在籍状況': emp.Status,
          '入社日': emp.JoinDate ? emp.JoinDate.substring(0, 10) : '',
          '割当種別': '',
          '電話番号': '',
          'SIM識別番号': '',
          'キャリア': '',
          'SIM種別': '',
          '端末機種': '',
          'IMEI': '',
          '貸与開始日': '',
          '備考': emp.Remarks || '',
        });
      } else {
        for (const alloc of emp.allocations) {
          rows.push({
            '従業員番号': emp.Title,
            '氏名': emp.EmployeeName,
            '部署': emp.Department,
            '役職': emp.JobTitle,
            '在籍状況': emp.Status,
            '入社日': emp.JoinDate ? emp.JoinDate.substring(0, 10) : '',
            '割当種別': alloc.AllocationType,
            '電話番号': alloc.phoneNumberInfo?.Title || '',
            'SIM識別番号': alloc.simInfo?.Title || '',
            'キャリア': alloc.simInfo?.Carrier || '',
            'SIM種別': alloc.simInfo?.SimType || '',
            '端末機種': alloc.deviceInfo?.DeviceModel || '',
            'IMEI': alloc.deviceInfo?.Title || '',
            '貸与開始日': alloc.StartDate ? alloc.StartDate.substring(0, 10) : '',
            '備考': alloc.Notes || '',
          });
        }
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '社員台帳');
    XLSX.writeFile(wb, `社員台帳_${this._today()}.xlsx`);
  }

  // 資産一覧（SIM/端末/電話番号）をExcel出力
  public static exportAssetList(data: any[], sheetName: string, fileName: string): void {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}_${this._today()}.xlsx`);
  }

  private static _today(): string {
    return new Date().toISOString().substring(0, 10).replace(/-/g, '');
  }
}
