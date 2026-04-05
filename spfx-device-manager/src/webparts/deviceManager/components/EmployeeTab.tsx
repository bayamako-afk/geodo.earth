import * as React from 'react';
import {
  DetailsList, DetailsListLayoutMode, SelectionMode, IColumn,
  SearchBox, PrimaryButton, DefaultButton, Panel, PanelType,
  TextField, Dropdown, IDropdownOption, Stack, Label, Text,
  MessageBar, MessageBarType, Spinner, SpinnerSize, IconButton,
  TooltipHost, Badge, Persona, PersonaSize,
} from '@fluentui/react';
import { IEmployee, IEmployeeView, IAllocationView, ISim, IDevice, IPhoneNumber, IAllocation } from '../models/IModels';
import { SpService } from '../services/SpService';
import { ExcelExportService } from '../services/ExcelExportService';
import { ImportPanel } from './ImportPanel';

interface IEmployeeTabProps {
  spService: SpService;
  isAdmin: boolean;
}

interface IEmployeeTabState {
  employees: IEmployeeView[];
  sims: ISim[];
  devices: IDevice[];
  phoneNumbers: IPhoneNumber[];
  loading: boolean;
  searchText: string;
  filterDept: string;
  filterStatus: string;
  isPanelOpen: boolean;
  isAllocPanelOpen: boolean;
  isImportPanelOpen: boolean;
  editEmployee: IEmployee | null;
  editAllocation: IAllocation | null;
  selectedEmployee: IEmployeeView | null;
  error: string;
  saving: boolean;
}

const DEPT_OPTIONS: IDropdownOption[] = [
  { key: '', text: '全部署' },
  { key: '代表取締役社長', text: '代表取締役社長' },
  { key: '取締役', text: '取締役' },
  { key: '管理部', text: '管理部' },
  { key: '開発部', text: '開発部' },
  { key: 'BSI事業部', text: 'BSI事業部' },
  { key: 'VS事業部', text: 'VS事業部' },
  { key: 'その他', text: 'その他' },
];

const STATUS_OPTIONS: IDropdownOption[] = [
  { key: '', text: '全状態' },
  { key: '在籍', text: '在籍' },
  { key: '休職', text: '休職' },
  { key: '退職', text: '退職' },
];

export class EmployeeTab extends React.Component<IEmployeeTabProps, IEmployeeTabState> {
  constructor(props: IEmployeeTabProps) {
    super(props);
    this.state = {
      employees: [], sims: [], devices: [], phoneNumbers: [],
      loading: true, searchText: '', filterDept: '', filterStatus: '',
      isPanelOpen: false, isAllocPanelOpen: false, isImportPanelOpen: false,
      editEmployee: null, editAllocation: null, selectedEmployee: null,
      error: '', saving: false,
    };
  }

  public async componentDidMount(): Promise<void> {
    await this._loadData();
  }

  private async _loadData(): Promise<void> {
    this.setState({ loading: true, error: '' });
    try {
      const { spService } = this.props;
      const [employees, allocations, sims, devices, phoneNumbers] = await Promise.all([
        spService.getEmployees(),
        spService.getAllocations(false),
        spService.getSims(),
        spService.getDevices(),
        spService.getPhoneNumbers(),
      ]);

      const simMap = new Map(sims.map(s => [s.Id!, s]));
      const deviceMap = new Map(devices.map(d => [d.Id!, d]));
      const phoneMap = new Map(phoneNumbers.map(p => [p.Id!, p]));

      const employeeViews: IEmployeeView[] = employees.map(emp => ({
        ...emp,
        allocations: allocations
          .filter(a => a.EmployeeId === emp.Id && a.IsCurrent)
          .map(a => ({
            ...a,
            simInfo: a.SimId ? simMap.get(a.SimId) : undefined,
            deviceInfo: a.DeviceId ? deviceMap.get(a.DeviceId) : undefined,
            phoneNumberInfo: a.PhoneNumberId ? phoneMap.get(a.PhoneNumberId) : undefined,
          } as IAllocationView)),
      }));

      this.setState({ employees: employeeViews, sims, devices, phoneNumbers, loading: false });
    } catch (e: any) {
      this.setState({ loading: false, error: `データ読み込みエラー: ${e.message}` });
    }
  }

  private _getFilteredEmployees(): IEmployeeView[] {
    const { employees, searchText, filterDept, filterStatus } = this.state;
    return employees.filter(emp => {
      const matchSearch = !searchText || [emp.EmployeeName, emp.Title, emp.Department, emp.JobTitle,
        ...emp.allocations.map(a => [a.phoneNumberInfo?.Title, a.simInfo?.Title, a.deviceInfo?.Title, a.deviceInfo?.DeviceModel].join(' '))
      ].join(' ').toLowerCase().includes(searchText.toLowerCase());
      const matchDept = !filterDept || emp.Department === filterDept;
      const matchStatus = !filterStatus || emp.Status === filterStatus;
      return matchSearch && matchDept && matchStatus;
    });
  }

  private _getColumns(): IColumn[] {
    return [
      { key: 'name', name: '氏名', fieldName: 'EmployeeName', minWidth: 80, maxWidth: 120, isResizable: true,
        onRender: (item: IEmployeeView) => (
          <Persona text={item.EmployeeName} size={PersonaSize.size24} hidePersonaDetails={false} />
        )
      },
      { key: 'empno', name: '社員番号', fieldName: 'Title', minWidth: 60, maxWidth: 80, isResizable: true,
        onRender: (item: IEmployeeView) => <span style={{ fontSize: 11, color: '#605e5c' }}>{item.Title}</span>
      },
      { key: 'dept', name: '部署', fieldName: 'Department', minWidth: 80, maxWidth: 110, isResizable: true },
      { key: 'mobile', name: 'Teamsphone', fieldName: 'MobileNumber', minWidth: 110, maxWidth: 140, isResizable: true,
        onRender: (item: IEmployeeView) => <span style={{ fontSize: 11 }}>{item.MobileNumber || ''}</span>
      },
      { key: 'teamsp', name: 'Teams外線', fieldName: 'TeamsPhone', minWidth: 110, maxWidth: 140, isResizable: true,
        onRender: (item: IEmployeeView) => <span style={{ fontSize: 11 }}>{item.TeamsPhone || ''}</span>
      },
      { key: 'email', name: 'メール', fieldName: 'Email', minWidth: 150, maxWidth: 210, isResizable: true,
        onRender: (item: IEmployeeView) => <span style={{ fontSize: 11 }}>{item.Email || ''}</span>
      },
      { key: 'hibino', name: 'HIBINO番号', fieldName: 'HibinoEmployeeNo', minWidth: 70, maxWidth: 90, isResizable: true,
        onRender: (item: IEmployeeView) => <span style={{ fontSize: 11, color: '#605e5c' }}>{item.HibinoEmployeeNo || ''}</span>
      },
      { key: 'phone', name: '電話番号', minWidth: 110, maxWidth: 140, isResizable: true,
        onRender: (item: IEmployeeView) => {
          const phones = item.allocations.filter(a => a.phoneNumberInfo).map(a => (
            <div key={a.Id} style={{ fontSize: 11 }}>
              <span style={{ color: '#0078d4' }}>{a.phoneNumberInfo!.Title}</span>
              <span style={{ color: '#797775', marginLeft: 4 }}>({a.phoneNumberInfo!.NumberType})</span>
            </div>
          ));
          return <>{phones}</>;
        }
      },
      { key: 'sim', name: 'SIM', minWidth: 120, maxWidth: 160, isResizable: true,
        onRender: (item: IEmployeeView) => {
          const simAllocs = item.allocations.filter(a => a.simInfo);
          return <>{simAllocs.map(a => (
            <div key={a.Id} style={{ fontSize: 11 }}>
              <span>{a.simInfo!.Carrier}</span>
              <span style={{ color: '#797775', marginLeft: 4 }}>{a.simInfo!.SimType === 'データSIM' ? '[D]' : '[V]'}</span>
              <span style={{ color: '#605e5c', marginLeft: 4, fontSize: 10 }}>{a.simInfo!.Title}</span>
            </div>
          ))}</>;
        }
      },
      { key: 'device', name: '端末', minWidth: 120, maxWidth: 160, isResizable: true,
        onRender: (item: IEmployeeView) => {
          const devAllocs = item.allocations.filter(a => a.deviceInfo);
          return <>{devAllocs.map(a => (
            <div key={a.Id} style={{ fontSize: 11 }}>
              <span>{a.deviceInfo!.DeviceModel}</span>
              <span style={{ color: '#797775', marginLeft: 4, fontSize: 10 }}>{a.deviceInfo!.Title}</span>
            </div>
          ))}</>;
        }
      },
      ...(this.props.isAdmin ? [{
        key: 'actions', name: '操作', minWidth: 100, maxWidth: 120,
        onRender: (item: IEmployeeView) => (
          <Stack horizontal tokens={{ childrenGap: 4 }}>
            <TooltipHost content="編集">
              <IconButton iconProps={{ iconName: 'Edit' }} onClick={() => this._openEditEmployee(item)} styles={{ root: { height: 24 } }} />
            </TooltipHost>
            <TooltipHost content="割当変更">
              <IconButton iconProps={{ iconName: 'Link' }} onClick={() => this._openAllocPanel(item)} styles={{ root: { height: 24 } }} />
            </TooltipHost>
          </Stack>
        )
      }] : []),
    ];
  }

  private _openEditEmployee(emp?: IEmployeeView): void {
    this.setState({
      editEmployee: emp ? { ...emp } : {
        Title: '', EmployeeName: '', Department: '', JobTitle: '',
        MobileNumber: '', TeamsPhone: '', Email: '', HibinoEmployeeNo: '', Status: '在籍'
      },
      isPanelOpen: true,
    });
  }

  private _openAllocPanel(emp: IEmployeeView): void {
    this.setState({
      selectedEmployee: emp,
      editAllocation: {
        Title: `ALLOC-${Date.now()}`, EmployeeId: emp.Id!, AllocationType: 'SIM+端末セット',
        StartDate: new Date().toISOString().substring(0, 10), IsCurrent: true,
      },
      isAllocPanelOpen: true,
    });
  }

  private async _saveEmployee(): Promise<void> {
    const { editEmployee } = this.state;
    if (!editEmployee) return;
    this.setState({ saving: true });
    try {
      await this.props.spService.saveEmployee(editEmployee);
      this.setState({ isPanelOpen: false, saving: false });
      await this._loadData();
    } catch (e: any) {
      this.setState({ error: `保存エラー: ${e.message}`, saving: false });
    }
  }

  private async _saveAllocation(): Promise<void> {
    const { editAllocation } = this.state;
    if (!editAllocation) return;
    this.setState({ saving: true });
    try {
      await this.props.spService.saveAllocation(editAllocation);
      // 資産ステータスを「利用中」に更新
      if (editAllocation.SimId) await this.props.spService.updateSimStatus(editAllocation.SimId, '利用中');
      if (editAllocation.DeviceId) await this.props.spService.updateDeviceStatus(editAllocation.DeviceId, '利用中');
      if (editAllocation.PhoneNumberId) await this.props.spService.updatePhoneNumberStatus(editAllocation.PhoneNumberId, '利用中');
      this.setState({ isAllocPanelOpen: false, saving: false });
      await this._loadData();
    } catch (e: any) {
      this.setState({ error: `保存エラー: ${e.message}`, saving: false });
    }
  }

  public render(): React.ReactElement {
    const { loading, error, searchText, filterDept, filterStatus, isPanelOpen, isAllocPanelOpen, isImportPanelOpen,
      editEmployee, editAllocation, selectedEmployee, sims, devices, phoneNumbers, saving } = this.state;
    const filtered = this._getFilteredEmployees();
    const { isAdmin } = this.props;

    const availableSims = sims.filter(s => s.Status === '在庫(未割当)');
    const availableDevices = devices.filter(d => d.Status === '在庫');
    const availablePhones = phoneNumbers.filter(p => p.Status === '空き(未割当)');

    return (
      <div style={{ padding: '8px 0' }}>
        {error && <MessageBar messageBarType={MessageBarType.error} onDismiss={() => this.setState({ error: '' })}>{error}</MessageBar>}

        {/* ツールバー */}
        <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center" style={{ marginBottom: 8 }}>
          <SearchBox placeholder="氏名・部署・番号・IMEI で検索..." value={searchText}
            onChange={(_, v) => this.setState({ searchText: v || '' })} style={{ width: 260 }} />
          <Dropdown options={DEPT_OPTIONS} selectedKey={filterDept}
            onChange={(_, o) => this.setState({ filterDept: o?.key as string || '' })} style={{ width: 120 }} />
          <Dropdown options={STATUS_OPTIONS} selectedKey={filterStatus}
            onChange={(_, o) => this.setState({ filterStatus: o?.key as string || '' })} style={{ width: 100 }} />
          <span style={{ color: '#605e5c', fontSize: 12 }}>{filtered.length}件</span>
          {isAdmin && (
            <PrimaryButton text="新規社員登録" iconProps={{ iconName: 'AddFriend' }} onClick={() => this._openEditEmployee()} styles={{ root: { height: 28, fontSize: 12 } }} />
          )}
          {isAdmin && (
            <DefaultButton text="Excelインポート" iconProps={{ iconName: 'Import' }}
              onClick={() => this.setState({ isImportPanelOpen: true })} styles={{ root: { height: 28, fontSize: 12 } }} />
          )}
          <DefaultButton text="Excelエクスポート" iconProps={{ iconName: 'ExcelDocument' }}
            onClick={() => ExcelExportService.exportEmployeeList(filtered)} styles={{ root: { height: 28, fontSize: 12 } }} />
          <DefaultButton text="更新" iconProps={{ iconName: 'Refresh' }} onClick={() => this._loadData()} styles={{ root: { height: 28, fontSize: 12 } }} />
        </Stack>

        {loading ? <Spinner size={SpinnerSize.medium} label="読み込み中..." /> : (
          <DetailsList items={filtered} columns={this._getColumns()} layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none} compact={true} />
        )}

        {/* 社員編集パネル */}
        <Panel isOpen={isPanelOpen} type={PanelType.medium} headerText={editEmployee?.Id ? '社員情報を編集' : '新規社員登録'}
          onDismiss={() => this.setState({ isPanelOpen: false })}
          onRenderFooterContent={() => (
            <Stack horizontal tokens={{ childrenGap: 8 }}>
              <PrimaryButton text="保存" onClick={() => this._saveEmployee()} disabled={saving} />
              <DefaultButton text="キャンセル" onClick={() => this.setState({ isPanelOpen: false })} />
            </Stack>
          )} isFooterAtBottom>
          {editEmployee && (
            <Stack tokens={{ childrenGap: 10 }} style={{ padding: '16px 0' }}>
              <Stack horizontal tokens={{ childrenGap: 8 }}>
                <TextField label="社員番号" value={editEmployee.Title} onChange={(_, v) => this.setState({ editEmployee: { ...editEmployee, Title: v || '' } })} required styles={{ root: { width: 120 } }} />
                <TextField label="氏名" value={editEmployee.EmployeeName} onChange={(_, v) => this.setState({ editEmployee: { ...editEmployee, EmployeeName: v || '' } })} required styles={{ root: { flex: 1 } }} />
              </Stack>
              <Stack horizontal tokens={{ childrenGap: 8 }}>
                <Dropdown label="部署" selectedKey={editEmployee.Department}
                  options={DEPT_OPTIONS.filter(o => o.key !== '').map(o => ({ key: o.key as string, text: o.text }))}
                  onChange={(_, o) => this.setState({ editEmployee: { ...editEmployee, Department: o?.key as string || '' } })}
                  styles={{ root: { flex: 1 } }} />
                <TextField label="役職" value={editEmployee.JobTitle || ''} onChange={(_, v) => this.setState({ editEmployee: { ...editEmployee, JobTitle: v || '' } })} styles={{ root: { flex: 1 } }} />
              </Stack>
              <Stack horizontal tokens={{ childrenGap: 8 }}>
                <TextField label="Teamsphone（携帯番号）" value={editEmployee.MobileNumber || ''} onChange={(_, v) => this.setState({ editEmployee: { ...editEmployee, MobileNumber: v || '' } })} styles={{ root: { flex: 1 } }} />
                <TextField label="Teams外線番号" value={editEmployee.TeamsPhone || ''} onChange={(_, v) => this.setState({ editEmployee: { ...editEmployee, TeamsPhone: v || '' } })} styles={{ root: { flex: 1 } }} />
              </Stack>
              <TextField label="メールアドレス" value={editEmployee.Email || ''} onChange={(_, v) => this.setState({ editEmployee: { ...editEmployee, Email: v || '' } })} />
              <Stack horizontal tokens={{ childrenGap: 8 }}>
                <TextField label="HIBINO社員番号" value={editEmployee.HibinoEmployeeNo || ''} onChange={(_, v) => this.setState({ editEmployee: { ...editEmployee, HibinoEmployeeNo: v || '' } })} styles={{ root: { width: 140 } }} />
                <Dropdown label="在籍状況" selectedKey={editEmployee.Status}
                  options={[{ key: '在籍', text: '在籍' }, { key: '休職', text: '休職' }, { key: '退職', text: '退職' }]}
                  onChange={(_, o) => this.setState({ editEmployee: { ...editEmployee, Status: o?.key as any } })}
                  styles={{ root: { flex: 1 } }} />
              </Stack>
              <Stack horizontal tokens={{ childrenGap: 8 }}>
                <TextField label="入社日" type="date" value={editEmployee.JoinDate?.substring(0, 10) || ''} onChange={(_, v) => this.setState({ editEmployee: { ...editEmployee, JoinDate: v || '' } })} styles={{ root: { flex: 1 } }} />
                <TextField label="退社日" type="date" value={editEmployee.LeaveDate?.substring(0, 10) || ''} onChange={(_, v) => this.setState({ editEmployee: { ...editEmployee, LeaveDate: v || '' } })} styles={{ root: { flex: 1 } }} />
              </Stack>
              <TextField label="備考" multiline rows={2} value={editEmployee.Remarks || ''} onChange={(_, v) => this.setState({ editEmployee: { ...editEmployee, Remarks: v || '' } })} />
            </Stack>
          )}
        </Panel>

        {/* Excelインポートパネル */}
        <ImportPanel
          isOpen={isImportPanelOpen}
          spService={this.props.spService}
          onDismiss={() => this.setState({ isImportPanelOpen: false })}
          onImported={() => { this.setState({ isImportPanelOpen: false }); this._loadData(); }}
        />

        {/* 割当パネル */}
        <Panel isOpen={isAllocPanelOpen} type={PanelType.medium}
          headerText={`割当管理: ${selectedEmployee?.EmployeeName || ''}`}
          onDismiss={() => this.setState({ isAllocPanelOpen: false })}
          onRenderFooterContent={() => (
            <Stack horizontal tokens={{ childrenGap: 8 }}>
              <PrimaryButton text="割当を保存" onClick={() => this._saveAllocation()} disabled={saving} />
              <DefaultButton text="キャンセル" onClick={() => this.setState({ isAllocPanelOpen: false })} />
            </Stack>
          )} isFooterAtBottom>
          {editAllocation && (
            <Stack tokens={{ childrenGap: 12 }} style={{ padding: '16px 0' }}>
              <Dropdown label="割当種別" selectedKey={editAllocation.AllocationType}
                options={[
                  { key: 'SIM+端末セット', text: 'SIM+端末セット' },
                  { key: '端末のみ', text: '端末のみ' },
                  { key: 'SIMのみ', text: 'SIMのみ' },
                  { key: 'Teams外線のみ', text: 'Teams外線のみ' },
                ]}
                onChange={(_, o) => this.setState({ editAllocation: { ...editAllocation, AllocationType: o?.key as any } })} />
              {(editAllocation.AllocationType === 'SIM+端末セット' || editAllocation.AllocationType === 'SIMのみ') && (
                <Dropdown label="SIM（在庫から選択）" selectedKey={editAllocation.SimId}
                  options={[{ key: undefined, text: '選択してください' }, ...availableSims.map(s => ({ key: s.Id, text: `${s.Title} (${s.Carrier} / ${s.SimType})` }))]}
                  onChange={(_, o) => this.setState({ editAllocation: { ...editAllocation, SimId: o?.key as number } })} />
              )}
              {(editAllocation.AllocationType === 'SIM+端末セット' || editAllocation.AllocationType === '端末のみ') && (
                <Dropdown label="端末（在庫から選択）" selectedKey={editAllocation.DeviceId}
                  options={[{ key: undefined, text: '選択してください' }, ...availableDevices.map(d => ({ key: d.Id, text: `${d.DeviceModel} (IMEI: ${d.Title})` }))]}
                  onChange={(_, o) => this.setState({ editAllocation: { ...editAllocation, DeviceId: o?.key as number } })} />
              )}
              {(editAllocation.AllocationType === 'Teams外線のみ' || editAllocation.AllocationType === 'SIM+端末セット' || editAllocation.AllocationType === 'SIMのみ') && (
                <Dropdown label="電話番号（空きから選択）" selectedKey={editAllocation.PhoneNumberId}
                  options={[{ key: undefined, text: '選択してください（任意）' }, ...availablePhones.map(p => ({ key: p.Id, text: `${p.Title} (${p.NumberType})` }))]}
                  onChange={(_, o) => this.setState({ editAllocation: { ...editAllocation, PhoneNumberId: o?.key as number } })} />
              )}
              <TextField label="貸与開始日" type="date" value={editAllocation.StartDate?.substring(0, 10) || ''}
                onChange={(_, v) => this.setState({ editAllocation: { ...editAllocation, StartDate: v || '' } })} />
              <TextField label="特記事項" multiline rows={2} value={editAllocation.Notes || ''}
                onChange={(_, v) => this.setState({ editAllocation: { ...editAllocation, Notes: v || '' } })} />
            </Stack>
          )}
        </Panel>
      </div>
    );
  }
}
