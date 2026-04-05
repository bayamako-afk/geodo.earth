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
      const baseRow = {
        '社員番号': emp.Title,
        '氏名': emp.EmployeeName,
        '部署': emp.Department,
        '役職': emp.JobTitle || '',
        '携帯番号': emp.MobileNumber || '',
        'Teams外線番号': emp.TeamsPhone || '',
        'メールアドレス': emp.Email || '',
        'HIBINO社員番号': emp.HibinoEmployeeNo || '',
        '在籍状況': emp.Status,
        '入社日': emp.JoinDate ? emp.JoinDate.substring(0, 10) : '',
      };
      if (emp.allocations.length === 0) {
        rows.push({
          ...baseRow,
          '割当種別': '',
          'SIM識別名': '',
          'ICCID': '',
          '電話番号(SIM)': '',
          'キャリア': '',
          'SIM種別': '',
          'プラン': '',
          '端末機種': '',
          'IMEI': '',
          '貸与開始日': '',
          '備考': emp.Remarks || '',
        });
      } else {
        for (const alloc of emp.allocations) {
          rows.push({
            ...baseRow,
            '割当種別': alloc.AllocationType,
            'SIM識別名': alloc.simInfo?.Title || '',
            'ICCID': alloc.simInfo?.ICCID || '',
            '電話番号(SIM)': alloc.simInfo?.PhoneNo || '',
            'キャリア': alloc.simInfo?.Carrier || '',
            'SIM種別': alloc.simInfo?.SimType || '',
            'プラン': alloc.simInfo?.PlanName || '',
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
