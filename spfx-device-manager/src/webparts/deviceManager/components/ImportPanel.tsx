import * as React from 'react';
import * as XLSX from 'xlsx';
import {
  Panel, PanelType, PrimaryButton, DefaultButton, Stack, Text,
  MessageBar, MessageBarType, Spinner, SpinnerSize, Label,
  DetailsList, DetailsListLayoutMode, SelectionMode, IColumn,
  Dropdown, IDropdownOption,
} from '@fluentui/react';
import { SpService } from '../services/SpService';
import { IEmployee } from '../models/IModels';

interface IImportPanelProps {
  isOpen: boolean;
  spService: SpService;
  onDismiss: () => void;
  onImported: () => void;
}

interface IColumnMapping {
  excelCol: string;
  systemField: string;
}

interface IImportPanelState {
  step: 'upload' | 'mapping' | 'preview' | 'importing' | 'done';
  excelHeaders: string[];
  excelRows: any[][];
  columnMappings: IColumnMapping[];
  previewData: IEmployee[];
  importing: boolean;
  importedCount: number;
  errorCount: number;
  errors: string[];
  message: string;
}

// システムフィールドの定義
const SYSTEM_FIELDS: IDropdownOption[] = [
  { key: '', text: '（マッピングしない）' },
  { key: 'Title', text: '社員番号 *' },
  { key: 'EmployeeName', text: '氏名 *' },
  { key: 'Department', text: '部署' },
  { key: 'JobTitle', text: '役職' },
  { key: 'MobileNumber', text: 'Teamsphone（携帯番号）' },
  { key: 'TeamsPhone', text: 'Teams外線番号' },
  { key: 'Email', text: 'メールアドレス' },
  { key: 'HibinoEmployeeNo', text: 'HIBINO社員番号' },
  { key: 'Status', text: '在籍状況' },
  { key: 'JoinDate', text: '入社日' },
  { key: 'LeaveDate', text: '退社日' },
  { key: 'Remarks', text: '備考' },
];

// Excelヘッダーからシステムフィールドへの自動マッピング
const AUTO_MAPPING: Record<string, string> = {
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

export class ImportPanel extends React.Component<IImportPanelProps, IImportPanelState> {
  private _fileInputRef = React.createRef<HTMLInputElement>();

  constructor(props: IImportPanelProps) {
    super(props);
    this.state = {
      step: 'upload',
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

  private _handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (json.length < 2) {
          this.setState({ message: 'Excelファイルにデータが見つかりません。' });
          return;
        }

        const headers = (json[0] as any[]).map(h => String(h).trim());
        const rows = json.slice(1).filter(r => r.some(c => c !== ''));

        // 自動マッピング
        const mappings: IColumnMapping[] = headers.map(h => ({
          excelCol: h,
          systemField: AUTO_MAPPING[h] || AUTO_MAPPING[h.toLowerCase()] || '',
        }));

        this.setState({
          step: 'mapping',
          excelHeaders: headers,
          excelRows: rows,
          columnMappings: mappings,
          message: '',
        });
      } catch (err: any) {
        this.setState({ message: `ファイル読み込みエラー: ${err.message}` });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private _buildPreview(): void {
    const { excelRows, columnMappings } = this.state;
    const preview: IEmployee[] = [];

    for (const row of excelRows.slice(0, 5)) {
      const emp: any = { Status: '在籍' };
      columnMappings.forEach((m, i) => {
        if (m.systemField && row[i] !== undefined && row[i] !== '') {
          emp[m.systemField] = String(row[i]).trim();
        }
      });
      if (emp.Title || emp.EmployeeName) {
        preview.push(emp as IEmployee);
      }
    }

    this.setState({ step: 'preview', previewData: preview });
  }

  private async _startImport(): Promise<void> {
    const { excelRows, columnMappings } = this.state;
    this.setState({ step: 'importing', importing: true, importedCount: 0, errorCount: 0, errors: [] });

    let imported = 0;
    let errCount = 0;
    const errs: string[] = [];

    for (const row of excelRows) {
      const emp: any = { Status: '在籍' };
      columnMappings.forEach((m, i) => {
        if (m.systemField && row[i] !== undefined && row[i] !== '') {
          emp[m.systemField] = String(row[i]).trim();
        }
      });

      if (!emp.Title && !emp.EmployeeName) continue;
      if (!emp.Title) emp.Title = '';
      if (!emp.EmployeeName) emp.EmployeeName = emp.Title;

      try {
        await this.props.spService.saveEmployee(emp as IEmployee);
        imported++;
      } catch (e: any) {
        errCount++;
        errs.push(`行 ${excelRows.indexOf(row) + 2}: ${e.message}`);
      }
    }

    this.setState({
      step: 'done',
      importing: false,
      importedCount: imported,
      errorCount: errCount,
      errors: errs,
    });
  }

  private _reset(): void {
    this.setState({
      step: 'upload',
      excelHeaders: [],
      excelRows: [],
      columnMappings: [],
      previewData: [],
      importing: false,
      importedCount: 0,
      errorCount: 0,
      errors: [],
      message: '',
    });
    if (this._fileInputRef.current) this._fileInputRef.current.value = '';
  }

  public render(): React.ReactElement {
    const { isOpen, onDismiss, onImported } = this.props;
    const { step, excelHeaders, excelRows, columnMappings, previewData,
      importing, importedCount, errorCount, errors, message } = this.state;

    return (
      <Panel isOpen={isOpen} type={PanelType.large} headerText="社員台帳 Excelインポート"
        onDismiss={() => { this._reset(); onDismiss(); }}
        onRenderFooterContent={() => (
          <Stack horizontal tokens={{ childrenGap: 8 }}>
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
            {(step === 'upload' || step === 'mapping') && (
              <DefaultButton text="キャンセル" onClick={() => { this._reset(); onDismiss(); }} />
            )}
          </Stack>
        )} isFooterAtBottom>

        <Stack tokens={{ childrenGap: 16 }} style={{ padding: '16px 0' }}>

          {/* ステップ1: ファイル選択 */}
          {step === 'upload' && (
            <Stack tokens={{ childrenGap: 12 }}>
              <MessageBar messageBarType={MessageBarType.info}>
                社員台帳のExcelファイル（.xlsx / .xls）を選択してください。
                1行目がヘッダー行として認識されます。
              </MessageBar>
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
                Excelの列と社員台帳のフィールドの対応を確認・修正してください。
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
                      options={SYSTEM_FIELDS}
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
                columns={[
                  { key: 'no', name: '社員番号', fieldName: 'Title', minWidth: 70, maxWidth: 90 },
                  { key: 'name', name: '氏名', fieldName: 'EmployeeName', minWidth: 80, maxWidth: 120 },
                  { key: 'dept', name: '部署', fieldName: 'Department', minWidth: 80, maxWidth: 110 },
                  { key: 'mobile', name: 'Teamsphone', fieldName: 'MobileNumber', minWidth: 100, maxWidth: 130 },
                  { key: 'email', name: 'メール', fieldName: 'Email', minWidth: 140, maxWidth: 200 },
                  { key: 'hibino', name: 'HIBINO番号', fieldName: 'HibinoEmployeeNo', minWidth: 70, maxWidth: 90 },
                ] as IColumn[]}
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
