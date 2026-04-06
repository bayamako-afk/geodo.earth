import * as React from 'react';
import * as XLSX from 'xlsx';
import {
  Panel, PanelType, PrimaryButton, DefaultButton, Stack, Text,
  MessageBar, MessageBarType, Spinner, SpinnerSize, Label,
  DetailsList, DetailsListLayoutMode, SelectionMode, IColumn,
  Dropdown, IDropdownOption, ChoiceGroup, IChoiceGroupOption,
} from '@fluentui/react';
import { SpService } from '../services/SpService';
import { IEmployee, ISim, IDevice } from '../models/IModels';

// ============================================================
// インポート種別
// ============================================================
export type ImportType = 'employee' | 'device' | 'sim';

interface IImportPanelProps {
  isOpen: boolean;
  spService: SpService;
  onDismiss: () => void;
  onImported: () => void;
  defaultImportType?: ImportType;
}

interface IColumnMapping {
  excelCol: string;
  systemField: string;
}

interface IImportPanelState {
  importType: ImportType;
  step: 'selectType' | 'upload' | 'mapping' | 'preview' | 'importing' | 'done';
  excelHeaders: string[];
  excelRows: any[][];
  columnMappings: IColumnMapping[];
  previewData: any[];
  importing: boolean;
  importedCount: number;
  errorCount: number;
  errors: string[];
  message: string;
}

// ============================================================
// 社員台帳フィールド定義
// ============================================================
const EMPLOYEE_FIELDS: IDropdownOption[] = [
  { key: '', text: '（マッピングしない）' },
  { key: 'Title', text: '社員番号 *' },
  { key: 'EmployeeName', text: '氏名 *' },
  { key: 'Department', text: '部署' },
  { key: 'JobTitle', text: '役職' },
  { key: 'MobileNumber', text: '携帯番号' },
  { key: 'TeamsPhone', text: 'Teams外線番号' },
  { key: 'Email', text: 'メールアドレス' },
  { key: 'HibinoEmployeeNo', text: 'HIBINO社員番号' },
  { key: 'Status', text: '在籍状況' },
  { key: 'JoinDate', text: '入社日' },
  { key: 'LeaveDate', text: '退社日' },
  { key: 'Remarks', text: '備考' },
];

const EMPLOYEE_AUTO_MAPPING: Record<string, string> = {
  '社員番号': 'Title',
  '通番': '',
  '氏名': 'EmployeeName',
  '名前': 'EmployeeName',
  '部署': 'Department',
  '役職': 'JobTitle',
  '携帯番号': 'MobileNumber',
  'teamsphone': 'MobileNumber',
  'Teamsphone': 'MobileNumber',
  'TeamsPhone': 'MobileNumber',
  'teams phone': 'MobileNumber',
  'Teams外線': 'TeamsPhone',
  'Teams外線番号': 'TeamsPhone',
  'メール': 'Email',
  'メールアドレス': 'Email',
  'mail': 'Email',
  'email': 'Email',
  'HIBINO社員番号': 'HibinoEmployeeNo',
  'HIBINO番号': 'HibinoEmployeeNo',
  '在籍': 'Status',
  '在籍状況': 'Status',
  '入社日': 'JoinDate',
  '退社日': 'LeaveDate',
  '備考': 'Remarks',
};

// ============================================================
// 端末フィールド定義
// ============================================================
const DEVICE_FIELDS: IDropdownOption[] = [
  { key: '', text: '（マッピングしない）' },
  { key: 'Title', text: 'IMEI *' },
  { key: 'SerialNumber', text: 'シリアル番号(S/N)' },
  { key: 'DeviceModel', text: '機種名 *' },
  { key: 'DeviceType', text: '端末種別' },
  { key: 'Status', text: '状態' },
  { key: 'PurchaseDate', text: '購入日' },
  { key: 'Remarks', text: '備考' },
];

const DEVICE_AUTO_MAPPING: Record<string, string> = {
  'IMEI': 'Title',
  'imei': 'Title',
  'シリアル番号': 'SerialNumber',
  'S/N': 'SerialNumber',
  's/n': 'SerialNumber',
  'SN': 'SerialNumber',
  '機種名': 'DeviceModel',
  '機種': 'DeviceModel',
  'モデル': 'DeviceModel',
  '端末種別': 'DeviceType',
  '種別': 'DeviceType',
  '状態': 'Status',
  '購入日': 'PurchaseDate',
  '備考': 'Remarks',
};

// ============================================================
// SIMフィールド定義
// ============================================================
const SIM_FIELDS: IDropdownOption[] = [
  { key: '', text: '（マッピングしない）' },
  { key: 'Title', text: 'SIM識別名 *' },
  { key: 'ICCID', text: 'ICCID' },
  { key: 'PhoneNo', text: '電話番号' },
  { key: 'Carrier', text: 'キャリア' },
  { key: 'SimType', text: 'SIM種別' },
  { key: 'PlanName', text: 'プラン名' },
  { key: 'DataSize', text: 'データ容量(GB)' },
  { key: 'MonthlyCost', text: '月額費用(円)' },
  { key: 'ContractDate', text: '契約開始日' },
  { key: 'Status', text: '状態' },
  { key: 'Remarks', text: '備考' },
];

const SIM_AUTO_MAPPING: Record<string, string> = {
  'SIM識別名': 'Title',
  'SIM名': 'Title',
  'ICCID': 'ICCID',
  'iccid': 'ICCID',
  '電話番号': 'PhoneNo',
  '携帯番号': 'PhoneNo',
  'キャリア': 'Carrier',
  '通信キャリア': 'Carrier',
  'SIM種別': 'SimType',
  '種別': 'SimType',
  'プラン': 'PlanName',
  'プラン名': 'PlanName',
  '契約プラン': 'PlanName',
  '月額': 'MonthlyCost',
  '月額費用': 'MonthlyCost',
  'データ容量': 'DataSize',
  '容量': 'DataSize',
  '容量(GB)': 'DataSize',
  'GB': 'DataSize',
  '契約開始日': 'ContractDate',
  '契約日': 'ContractDate',
  '状態': 'Status',
  '備考': 'Remarks',
};

// ============================================================
// プレビュー列定義
// ============================================================
const EMPLOYEE_PREVIEW_COLS: IColumn[] = [
  { key: 'no', name: '社員番号', fieldName: 'Title', minWidth: 70, maxWidth: 90 },
  { key: 'name', name: '氏名', fieldName: 'EmployeeName', minWidth: 80, maxWidth: 120 },
  { key: 'dept', name: '部署', fieldName: 'Department', minWidth: 80, maxWidth: 110 },
  { key: 'mobile', name: '携帯番号', fieldName: 'MobileNumber', minWidth: 100, maxWidth: 130 },
  { key: 'teams', name: 'Teams外線', fieldName: 'TeamsPhone', minWidth: 100, maxWidth: 130 },
  { key: 'email', name: 'メール', fieldName: 'Email', minWidth: 140, maxWidth: 200 },
  { key: 'hibino', name: 'HIBINO番号', fieldName: 'HibinoEmployeeNo', minWidth: 70, maxWidth: 90 },
];

const DEVICE_PREVIEW_COLS: IColumn[] = [
  { key: 'imei', name: 'IMEI', fieldName: 'Title', minWidth: 130, maxWidth: 160 },
  { key: 'sn', name: 'S/N', fieldName: 'SerialNumber', minWidth: 100, maxWidth: 130 },
  { key: 'model', name: '機種名', fieldName: 'DeviceModel', minWidth: 120, maxWidth: 160 },
  { key: 'type', name: '種別', fieldName: 'DeviceType', minWidth: 80, maxWidth: 100 },
  { key: 'status', name: '状態', fieldName: 'Status', minWidth: 60, maxWidth: 80 },
  { key: 'purchase', name: '購入日', fieldName: 'PurchaseDate', minWidth: 80, maxWidth: 100 },
];

const SIM_PREVIEW_COLS: IColumn[] = [
  { key: 'title', name: 'SIM識別名', fieldName: 'Title', minWidth: 90, maxWidth: 120 },
  { key: 'iccid', name: 'ICCID', fieldName: 'ICCID', minWidth: 130, maxWidth: 160 },
  { key: 'phoneno', name: '電話番号', fieldName: 'PhoneNo', minWidth: 100, maxWidth: 130 },
  { key: 'carrier', name: 'キャリア', fieldName: 'Carrier', minWidth: 70, maxWidth: 90 },
  { key: 'type', name: 'SIM種別', fieldName: 'SimType', minWidth: 80, maxWidth: 100 },
  { key: 'plan', name: 'プラン', fieldName: 'PlanName', minWidth: 90, maxWidth: 120 },
  { key: 'datasize', name: '容量(GB)', fieldName: 'DataSize', minWidth: 60, maxWidth: 80 },
];

export class ImportPanel extends React.Component<IImportPanelProps, IImportPanelState> {
  private _fileInputRef = React.createRef<HTMLInputElement>();

  constructor(props: IImportPanelProps) {
    super(props);
    const t = props.defaultImportType || 'employee';
    this.state = {
      importType: t,
      step: props.defaultImportType ? 'upload' : 'selectType',
      excelHeaders: [],
      excelRows: [],
      columnMappings: [],
      previewData: [],
      importing: false,
      importedCount: 0,
      errorCount: 0,
      errors: [],
      message: '',
    };
  }

  public componentDidUpdate(prevProps: IImportPanelProps): void {
    if (!prevProps.isOpen && this.props.isOpen) {
      const t = this.props.defaultImportType || 'employee';
      this.setState({
        importType: t,
        step: this.props.defaultImportType ? 'upload' : 'selectType',
        excelHeaders: [], excelRows: [], columnMappings: [], previewData: [],
        importing: false, importedCount: 0, errorCount: 0, errors: [], message: '',
      });
    }
  }

  private _getSystemFields(): IDropdownOption[] {
    const { importType } = this.state;
    if (importType === 'device') return DEVICE_FIELDS;
    if (importType === 'sim') return SIM_FIELDS;
    return EMPLOYEE_FIELDS;
  }

  private _getAutoMapping(): Record<string, string> {
    const { importType } = this.state;
    if (importType === 'device') return DEVICE_AUTO_MAPPING;
    if (importType === 'sim') return SIM_AUTO_MAPPING;
    return EMPLOYEE_AUTO_MAPPING;
  }

  private _getPreviewCols(): IColumn[] {
    const { importType } = this.state;
    if (importType === 'device') return DEVICE_PREVIEW_COLS;
    if (importType === 'sim') return SIM_PREVIEW_COLS;
    return EMPLOYEE_PREVIEW_COLS;
  }

  private _getImportTypeLabel(): string {
    const { importType } = this.state;
    if (importType === 'device') return '端末台帳';
    if (importType === 'sim') return 'SIM台帳';
    return '社員台帳';
  }

  private _handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
        if (json.length < 2) {
          this.setState({ message: 'Excelファイルにデータが見つかりません。' });
          return;
        }
        const headers = (json[0] as any[]).map(h => String(h).trim());
        const rows = json.slice(1).filter(r => r.some(c => c !== ''));
        const autoMap = this._getAutoMapping();
        const mappings: IColumnMapping[] = headers.map(h => ({
          excelCol: h,
          systemField: autoMap[h] || autoMap[h.toLowerCase()] || '',
        }));
        this.setState({ step: 'mapping', excelHeaders: headers, excelRows: rows, columnMappings: mappings, message: '' });
      } catch (err: any) {
        this.setState({ message: `ファイル読み込みエラー: ${err.message}` });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private _buildPreview(): void {
    const { excelRows, columnMappings, importType } = this.state;
    const preview: any[] = [];
    for (const row of excelRows.slice(0, 5)) {
      const item: any = importType === 'employee' ? { Status: '在籍' }
        : importType === 'device' ? { DeviceType: 'スマートフォン', Status: '在庫' }
        : { Carrier: 'KDDI', SimType: 'データ', Status: '在庫(未割当)' };
      columnMappings.forEach((m, i) => {
        if (m.systemField && row[i] !== undefined && row[i] !== '') {
          item[m.systemField] = String(row[i]).trim();
        }
      });
      preview.push(item);
    }
    this.setState({ step: 'preview', previewData: preview });
  }

  private async _startImport(): Promise<void> {
    const { excelRows, columnMappings, importType } = this.state;
    const { spService } = this.props;
    this.setState({ step: 'importing', importing: true, importedCount: 0, errorCount: 0, errors: [] });
    let imported = 0;
    let errCount = 0;
    const errs: string[] = [];

    for (let rowIdx = 0; rowIdx < excelRows.length; rowIdx++) {
      const row = excelRows[rowIdx];
      const item: any = importType === 'employee' ? { Status: '在籍' }
        : importType === 'device' ? { DeviceType: 'スマートフォン', Status: '在庫' }
        : { Carrier: 'KDDI', SimType: 'データ', Status: '在庫(未割当)' };

      columnMappings.forEach((m, i) => {
        const raw = row[i];
        if (m.systemField && raw !== undefined && raw !== '') {
          // 日付型の変換
          if (m.systemField === 'JoinDate' || m.systemField === 'LeaveDate' ||
              m.systemField === 'PurchaseDate' || m.systemField === 'ContractDate') {
            if (raw instanceof Date) {
              const y = raw.getFullYear();
              const mo = ('0' + (raw.getMonth() + 1)).slice(-2);
              const d = ('0' + raw.getDate()).slice(-2);
              item[m.systemField] = `${y}-${mo}-${d}`;
            } else {
              const s = String(raw).trim();
              // YYYY/MM/DD → YYYY-MM-DD
              item[m.systemField] = s.replace(/\//g, '-');
            }
          } else if (m.systemField === 'MonthlyCost' || m.systemField === 'DataSize') {
            // 数値型の変換
            const n = parseFloat(String(raw).replace(/[,¥]/g, ''));
            item[m.systemField] = isNaN(n) ? undefined : n;
          } else {
            // 文字列（数値も文字列に変換、先頭シングルクォートを除去）
            let s = String(raw).trim();
            if (s.startsWith("'")) s = s.slice(1);
            item[m.systemField] = s;
          }
        }
      });

      // SIM種別の値を正規化（表記ユレ対応）
      if (importType === 'sim' && item.SimType) {
        const simTypeMap: Record<string, string> = {
          '音声SIM': '音声', '音声sim': '音声', 'voice': '音声',
          'SMS付きデータSIM': 'SMS付データ', 'SMS付きデータ': 'SMS付データ',
          'SMS付データSIM': 'SMS付データ', 'SMS': 'SMS付データ',
          'データSIM': 'データ', 'data': 'データ',
        };
        item.SimType = simTypeMap[item.SimType] || item.SimType;
      }

      try {
        if (importType === 'employee') {
          const emp = item as IEmployee;
          if (!emp.Title && !emp.EmployeeName) continue;
          if (!emp.Title) emp.Title = '';
          if (!emp.EmployeeName) emp.EmployeeName = emp.Title;
          await spService.saveEmployee(emp);
        } else if (importType === 'device') {
          const dev = item as IDevice;
          if (!dev.Title && !dev.DeviceModel) continue;
          if (!dev.Title) dev.Title = '';
          if (!dev.DeviceModel) dev.DeviceModel = dev.Title;
          await spService.saveDevice(dev);
        } else {
          const sim = item as ISim;
          if (!sim.Title) continue;
          await spService.saveSim(sim);
        }
        imported++;
        this.setState({ importedCount: imported });
      } catch (e: any) {
        errCount++;
        errs.push(`行 ${rowIdx + 2}: ${e.message?.substring(0, 200) || e}`);
      }
    }

    this.setState({ step: 'done', importing: false, importedCount: imported, errorCount: errCount, errors: errs });
  }

  private _reset(): void {
    const t = this.props.defaultImportType || 'employee';
    this.setState({
      importType: t,
      step: this.props.defaultImportType ? 'upload' : 'selectType',
      excelHeaders: [], excelRows: [], columnMappings: [], previewData: [],
      importing: false, importedCount: 0, errorCount: 0, errors: [], message: '',
    });
    if (this._fileInputRef.current) this._fileInputRef.current.value = '';
  }

  public render(): React.ReactElement {
    const { isOpen, onDismiss, onImported } = this.props;
    const { step, importType, excelRows, columnMappings, previewData,
      importedCount, errorCount, errors, message } = this.state;
    const typeLabel = this._getImportTypeLabel();

    const typeChoices: IChoiceGroupOption[] = [
      { key: 'employee', text: '社員台帳', iconProps: { iconName: 'People' } },
      { key: 'device', text: '端末台帳', iconProps: { iconName: 'CellPhone' } },
      { key: 'sim', text: 'SIM台帳', iconProps: { iconName: 'Sim' } },
    ];

    return (
      <Panel
        isOpen={isOpen}
        type={PanelType.large}
        headerText={`Excelインポート${step !== 'selectType' ? ` - ${typeLabel}` : ''}`}
        onDismiss={() => { this._reset(); onDismiss(); }}
        onRenderFooterContent={() => (
          <Stack horizontal tokens={{ childrenGap: 8 }}>
            {step === 'selectType' && (
              <>
                <PrimaryButton text="次へ" onClick={() => this.setState({ step: 'upload' })} />
                <DefaultButton text="キャンセル" onClick={() => { this._reset(); onDismiss(); }} />
              </>
            )}
            {step === 'upload' && (
              <>
                {!this.props.defaultImportType && <DefaultButton text="戻る" onClick={() => this.setState({ step: 'selectType' })} />}
                <DefaultButton text="キャンセル" onClick={() => { this._reset(); onDismiss(); }} />
              </>
            )}
            {step === 'mapping' && (
              <>
                <PrimaryButton text="プレビューを確認" iconProps={{ iconName: 'Preview' }} onClick={() => this._buildPreview()} />
                <DefaultButton text="戻る" onClick={() => this.setState({ step: 'upload' })} />
              </>
            )}
            {step === 'preview' && (
              <>
                <PrimaryButton text={`${excelRows.length}件をインポート開始`} iconProps={{ iconName: 'Upload' }}
                  onClick={() => this._startImport()} />
                <DefaultButton text="マッピングを修正" onClick={() => this.setState({ step: 'mapping' })} />
              </>
            )}
            {step === 'done' && (
              <>
                <PrimaryButton text="完了して閉じる" onClick={() => { this._reset(); onImported(); onDismiss(); }} />
                <DefaultButton text="再度インポート" onClick={() => this._reset()} />
              </>
            )}
          </Stack>
        )}
        isFooterAtBottom
      >
        <Stack tokens={{ childrenGap: 16 }} style={{ padding: '16px 0' }}>

          {/* ステップ0: インポート種別選択 */}
          {step === 'selectType' && (
            <Stack tokens={{ childrenGap: 12 }}>
              <Text variant="mediumPlus" style={{ fontWeight: 600 }}>インポートするデータを選択してください</Text>
              <ChoiceGroup
                options={typeChoices}
                selectedKey={importType}
                onChange={(_, o) => this.setState({ importType: o?.key as ImportType || 'employee' })}
              />
            </Stack>
          )}

          {/* ステップ1: ファイル選択 */}
          {step === 'upload' && (
            <Stack tokens={{ childrenGap: 12 }}>
              <MessageBar messageBarType={MessageBarType.info}>
                {typeLabel}のExcelファイル（.xlsx / .xls）を選択してください。1行目がヘッダー行として認識されます。
              </MessageBar>
              {importType === 'device' && (
                <MessageBar messageBarType={MessageBarType.info}>
                  推奨列: IMEI、シリアル番号(S/N)、機種名、端末種別、状態、購入日、備考
                </MessageBar>
              )}
              {importType === 'sim' && (
                <MessageBar messageBarType={MessageBarType.info}>
                  推奨列: SIM識別名、ICCID、電話番号、キャリア、SIM種別、プラン名、月額費用、契約開始日、状態、備考
                </MessageBar>
              )}
              <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="end">
                <input ref={this._fileInputRef} type="file" accept=".xlsx,.xls"
                  onChange={(e) => this._handleFileChange(e)}
                  style={{ display: 'none' }} id="import-file-input" />
                <PrimaryButton text="Excelファイルを選択" iconProps={{ iconName: 'ExcelDocument' }}
                  onClick={() => this._fileInputRef.current?.click()} />
              </Stack>
              {message && <MessageBar messageBarType={MessageBarType.error}>{message}</MessageBar>}
            </Stack>
          )}

          {/* ステップ2: 列マッピング */}
          {step === 'mapping' && (
            <Stack tokens={{ childrenGap: 12 }}>
              <Text variant="mediumPlus" style={{ fontWeight: 600 }}>列マッピングの確認</Text>
              <Text variant="small" style={{ color: '#605e5c' }}>
                Excelの列と{typeLabel}のフィールドの対応を確認・修正してください。
                自動認識された列は緑色で表示されます。（全{excelRows.length}行）
              </Text>
              <Stack tokens={{ childrenGap: 6 }}>
                {columnMappings.map((m, i) => (
                  <Stack key={i} horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
                    <Label style={{ width: 160, fontSize: 12, color: m.systemField ? '#107c10' : '#605e5c' }}>
                      {m.excelCol}
                    </Label>
                    <span style={{ color: '#797775' }}>→</span>
                    <Dropdown
                      options={this._getSystemFields()}
                      selectedKey={m.systemField}
                      onChange={(_, o) => {
                        const updated = [...columnMappings];
                        updated[i] = { ...updated[i], systemField: o?.key as string || '' };
                        this.setState({ columnMappings: updated });
                      }}
                      styles={{ root: { width: 240 } }}
                    />
                  </Stack>
                ))}
              </Stack>
            </Stack>
          )}

          {/* ステップ3: プレビュー */}
          {step === 'preview' && (
            <Stack tokens={{ childrenGap: 12 }}>
              <Text variant="mediumPlus" style={{ fontWeight: 600 }}>インポートプレビュー（先頭5件）</Text>
              <Text variant="small" style={{ color: '#605e5c' }}>
                以下の内容で全{excelRows.length}件をインポートします。内容を確認して「インポート開始」を押してください。
              </Text>
              <DetailsList
                items={previewData}
                columns={this._getPreviewCols()}
                layoutMode={DetailsListLayoutMode.justified}
                selectionMode={SelectionMode.none}
                compact={true}
              />
            </Stack>
          )}

          {/* ステップ4: インポート中 */}
          {step === 'importing' && (
            <Stack tokens={{ childrenGap: 16 }} horizontalAlign="center" style={{ padding: '32px 0' }}>
              <Spinner size={SpinnerSize.large} label={`インポート中... ${importedCount}件完了`} />
            </Stack>
          )}

          {/* ステップ5: 完了 */}
          {step === 'done' && (
            <Stack tokens={{ childrenGap: 12 }}>
              <MessageBar messageBarType={errorCount === 0 ? MessageBarType.success : MessageBarType.warning}>
                インポート完了: {importedCount}件成功 / {errorCount}件エラー
              </MessageBar>
              {errors.length > 0 && (
                <Stack tokens={{ childrenGap: 4 }}>
                  <Text variant="small" style={{ fontWeight: 600, color: '#a4262c' }}>エラー詳細:</Text>
                  {errors.slice(0, 10).map((e, i) => (
                    <Text key={i} variant="small" style={{ color: '#a4262c' }}>{e}</Text>
                  ))}
                </Stack>
              )}
            </Stack>
          )}

        </Stack>
      </Panel>
    );
  }
}
