import * as React from 'react';
import {
  DetailsList, DetailsListLayoutMode, SelectionMode, IColumn,
  SearchBox, PrimaryButton, DefaultButton, Panel, PanelType,
  TextField, Dropdown, IDropdownOption, Stack, Text,
  MessageBar, MessageBarType, Spinner, SpinnerSize, IconButton,
  TooltipHost, Persona, PersonaSize, Separator, Label,
} from '@fluentui/react';
import { IEmployee, IEmployeeView, IAllocationView, ISim, IDevice, IAllocation } from '../models/IModels';
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
  loading: boolean;
  searchText: string;
  filterDept: string;
  filterStatus: string;
  isPanelOpen: boolean;
  isAllocPanelOpen: boolean;
  isImportPanelOpen: boolean;
  isSimPanelOpen: boolean;
  editEmployee: IEmployee | null;
  editAllocation: IAllocation | null;
  selectedEmployee: IEmployeeView | null;
  // SIM編集パネル用
  simPanelEmployee: IEmployeeView | null;
  editSimInPanel: ISim | null;          // 現在割当中のSIMを編集
  editEmployeeNumbers: { MobileNumber: string; TeamsPhone: string } | null;
  simPanelMode: 'view' | 'editNumbers' | 'editSim' | 'replaceSim';
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

const CARRIER_OPTIONS: IDropdownOption[] = [
  { key: 'KDDI', text: 'KDDI' },
  { key: 'HISモバイル', text: 'HISモバイル' },
  { key: 'docomo', text: 'docomo' },
  { key: 'SoftBank', text: 'SoftBank' },
  { key: 'その他', text: 'その他' },
];

const SIM_TYPE_OPTIONS: IDropdownOption[] = [
  { key: '音声', text: '音声' },
  { key: 'SMS付データ', text: 'SMS付データ' },
  { key: 'データ', text: 'データ' },
];

const SIM_STATUS_OPTIONS: IDropdownOption[] = [
  { key: '利用中', text: '利用中' },
  { key: '在庫(未割当)', text: '在庫(未割当)' },
  { key: '解約済', text: '解約済' },
  { key: '紛失', text: '紛失' },
];

export class EmployeeTab extends React.Component<IEmployeeTabProps, IEmployeeTabState> {
  constructor(props: IEmployeeTabProps) {
    super(props);
    this.state = {
      employees: [], sims: [], devices: [],
      loading: true, searchText: '', filterDept: '', filterStatus: '',
      isPanelOpen: false, isAllocPanelOpen: false, isImportPanelOpen: false, isSimPanelOpen: false,
      editEmployee: null, editAllocation: null, selectedEmployee: null,
      simPanelEmployee: null, editSimInPanel: null, editEmployeeNumbers: null, simPanelMode: 'view',
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
      const [employees, allocations, sims, devices] = await Promise.all([
        spService.getEmployees(),
        spService.getAllocations(false),
        spService.getSims(),
        spService.getDevices(),
      ]);

      const simMap = new Map(sims.map(s => [s.Id!, s]));
      const deviceMap = new Map(devices.map(d => [d.Id!, d]));

      const employeeViews: IEmployeeView[] = employees.map(emp => ({
        ...emp,
        allocations: allocations
          .filter(a => a.EmployeeId === emp.Id && a.IsCurrent)
          .map(a => ({
            ...a,
            simInfo: a.SimId ? simMap.get(a.SimId) : undefined,
            deviceInfo: a.DeviceId ? deviceMap.get(a.DeviceId) : undefined,
          } as IAllocationView)),
      }));

      // HIBINO番号順にソート（番号なしは末尾）
      employeeViews.sort((a, b) => {
        const na = a.HibinoEmployeeNo ? parseInt(a.HibinoEmployeeNo.replace(/\D/g, ''), 10) : Infinity;
        const nb = b.HibinoEmployeeNo ? parseInt(b.HibinoEmployeeNo.replace(/\D/g, ''), 10) : Infinity;
        if (isFinite(na) && isFinite(nb) && na !== nb) return na - nb;
        return (a.HibinoEmployeeNo || '').localeCompare(b.HibinoEmployeeNo || '', 'ja');
      });
      this.setState({ employees: employeeViews, sims, devices, loading: false });
    } catch (e: any) {
      this.setState({ loading: false, error: `データ読み込みエラー: ${e.message}` });
    }
  }

  private _getFilteredEmployees(): IEmployeeView[] {
    const { employees, searchText, filterDept, filterStatus } = this.state;
    return employees.filter(emp => {
      const matchSearch = !searchText || [emp.EmployeeName, emp.Title, emp.Department, emp.JobTitle,
        emp.MobileNumber, emp.TeamsPhone,
        ...emp.allocations.map(a => [a.simInfo?.Title, a.simInfo?.PhoneNo, a.deviceInfo?.Title, a.deviceInfo?.DeviceModel].join(' '))
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
      { key: 'mobile', name: '携帯番号', fieldName: 'MobileNumber', minWidth: 110, maxWidth: 140, isResizable: true,
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
      { key: 'sim', name: 'SIM', minWidth: 150, maxWidth: 200, isResizable: true,
        onRender: (item: IEmployeeView) => {
          const simAllocs = item.allocations.filter(a => a.simInfo);
          return <>{simAllocs.map(a => (
            <div key={a.Id} style={{ fontSize: 11 }}>
              <span style={{ fontWeight: 600, color: a.simInfo!.Carrier === 'KDDI' ? '#d83b01' : '#107c10' }}>{a.simInfo!.Carrier}</span>
              <span style={{ color: '#797775', marginLeft: 4 }}>
                {a.simInfo!.SimType === 'データ' ? '[D]' : a.simInfo!.SimType === 'SMS付データ' ? '[S]' : '[V]'}
              </span>
              {a.simInfo!.PhoneNo && <span style={{ color: '#0078d4', marginLeft: 4 }}>{a.simInfo!.PhoneNo}</span>}
              <span style={{ color: '#605e5c', marginLeft: 4, fontSize: 10 }}>{a.simInfo!.PlanName || ''}</span>
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
        key: 'actions', name: '操作', minWidth: 120, maxWidth: 140,
        onRender: (item: IEmployeeView) => (
          <Stack horizontal tokens={{ childrenGap: 4 }}>
            <TooltipHost content="社員情報を編集">
              <IconButton iconProps={{ iconName: 'Edit' }} onClick={() => this._openEditEmployee(item)} styles={{ root: { height: 24 } }} />
            </TooltipHost>
            <TooltipHost content="SIM・番号を編集">
              <IconButton iconProps={{ iconName: 'CellPhone' }} onClick={() => this._openSimPanel(item)} styles={{ root: { height: 24 } }} />
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

  private _openSimPanel(emp: IEmployeeView): void {
    // 現在割当中のSIM（最初の1件）を取得
    const simAlloc = emp.allocations.find(a => a.simInfo);
    this.setState({
      simPanelEmployee: emp,
      editSimInPanel: simAlloc?.simInfo ? { ...simAlloc.simInfo } : null,
      editEmployeeNumbers: { MobileNumber: emp.MobileNumber || '', TeamsPhone: emp.TeamsPhone || '' },
      simPanelMode: 'view',
      isSimPanelOpen: true,
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
      this.setState({ isAllocPanelOpen: false, saving: false });
      await this._loadData();
    } catch (e: any) {
      this.setState({ error: `保存エラー: ${e.message}`, saving: false });
    }
  }

  // SIMパネル: 番号（携帯番号・Teams外線）を保存
  private async _saveEmployeeNumbers(): Promise<void> {
    const { simPanelEmployee, editEmployeeNumbers } = this.state;
    if (!simPanelEmployee || !editEmployeeNumbers) return;
    this.setState({ saving: true });
    try {
      const updated: IEmployee = { ...simPanelEmployee, ...editEmployeeNumbers };
      await this.props.spService.saveEmployee(updated);
      this.setState({ simPanelMode: 'view', saving: false });
      await this._loadData();
      // パネル内のemployeeも更新
      const refreshed = this.state.employees.find(e => e.Id === simPanelEmployee.Id);
      if (refreshed) this.setState({ simPanelEmployee: refreshed });
    } catch (e: any) {
      this.setState({ error: `保存エラー: ${e.message}`, saving: false });
    }
  }

  // SIMパネル: 割当中SIMの詳細を保存
  private async _saveSimInPanel(): Promise<void> {
    const { editSimInPanel } = this.state;
    if (!editSimInPanel) return;
    this.setState({ saving: true });
    try {
      await this.props.spService.saveSim(editSimInPanel);
      this.setState({ simPanelMode: 'view', saving: false });
      await this._loadData();
    } catch (e: any) {
      this.setState({ error: `保存エラー: ${e.message}`, saving: false });
    }
  }

  // SIMパネル: SIMを差し替え（既存割当を終了して新規割当）
  private async _replaceSimInPanel(newSimId: number): Promise<void> {
    const { simPanelEmployee } = this.state;
    if (!simPanelEmployee) return;
    this.setState({ saving: true });
    try {
      const { spService } = this.props;
      // 既存の割当（SIMあり）を終了
      const currentSimAlloc = simPanelEmployee.allocations.find(a => a.simInfo);
      if (currentSimAlloc) {
        await spService.saveAllocation({ ...currentSimAlloc, IsCurrent: false, EndDate: new Date().toISOString().substring(0, 10) });
        if (currentSimAlloc.SimId) await spService.updateSimStatus(currentSimAlloc.SimId, '在庫(未割当)');
      }
      // 新規割当を作成
      await spService.saveAllocation({
        Title: `ALLOC-${Date.now()}`,
        EmployeeId: simPanelEmployee.Id!,
        AllocationType: 'SIMのみ',
        SimId: newSimId,
        StartDate: new Date().toISOString().substring(0, 10),
        IsCurrent: true,
      });
      await spService.updateSimStatus(newSimId, '利用中');
      this.setState({ simPanelMode: 'view', saving: false });
      await this._loadData();
      const refreshed = this.state.employees.find(e => e.Id === simPanelEmployee.Id);
      if (refreshed) {
        const simAlloc = refreshed.allocations.find(a => a.simInfo);
        this.setState({ simPanelEmployee: refreshed, editSimInPanel: simAlloc?.simInfo ? { ...simAlloc.simInfo } : null });
      }
    } catch (e: any) {
      this.setState({ error: `差し替えエラー: ${e.message}`, saving: false });
    }
  }

  private _renderSimPanel(): React.ReactElement | null {
    const { isSimPanelOpen, simPanelEmployee, editSimInPanel, editEmployeeNumbers, simPanelMode, sims, saving } = this.state;
    if (!simPanelEmployee) return null;

    const availableSims = sims.filter(s => s.Status === '在庫(未割当)');
    const emp = simPanelEmployee;

    return (
      <Panel
        isOpen={isSimPanelOpen}
        type={PanelType.medium}
        headerText={`SIM・番号管理: ${emp.EmployeeName}`}
        onDismiss={() => this.setState({ isSimPanelOpen: false, simPanelMode: 'view' })}
        isFooterAtBottom
        onRenderFooterContent={() => {
          if (simPanelMode === 'editNumbers') {
            return (
              <Stack horizontal tokens={{ childrenGap: 8 }}>
                <PrimaryButton text="番号を保存" onClick={() => this._saveEmployeeNumbers()} disabled={saving} />
                <DefaultButton text="キャンセル" onClick={() => this.setState({ simPanelMode: 'view' })} />
              </Stack>
            );
          }
          if (simPanelMode === 'editSim') {
            return (
              <Stack horizontal tokens={{ childrenGap: 8 }}>
                <PrimaryButton text="SIM情報を保存" onClick={() => this._saveSimInPanel()} disabled={saving} />
                <DefaultButton text="キャンセル" onClick={() => this.setState({ simPanelMode: 'view' })} />
              </Stack>
            );
          }
          return (
            <DefaultButton text="閉じる" onClick={() => this.setState({ isSimPanelOpen: false, simPanelMode: 'view' })} />
          );
        }}
      >
        <Stack tokens={{ childrenGap: 16 }} style={{ padding: '16px 0' }}>

          {/* ===== 携帯番号・Teams外線番号 ===== */}
          <div style={{ background: '#f3f2f1', borderRadius: 6, padding: '12px 14px' }}>
            <Stack horizontal horizontalAlign="space-between" verticalAlign="center" style={{ marginBottom: 8 }}>
              <Text variant="mediumPlus" style={{ fontWeight: 600 }}>電話番号</Text>
              {simPanelMode !== 'editNumbers' && (
                <DefaultButton text="編集" iconProps={{ iconName: 'Edit' }} styles={{ root: { height: 24, fontSize: 11 } }}
                  onClick={() => this.setState({ simPanelMode: 'editNumbers', editEmployeeNumbers: { MobileNumber: emp.MobileNumber || '', TeamsPhone: emp.TeamsPhone || '' } })} />
              )}
            </Stack>
            {simPanelMode === 'editNumbers' && editEmployeeNumbers ? (
              <Stack tokens={{ childrenGap: 8 }}>
                <TextField label="携帯番号" value={editEmployeeNumbers.MobileNumber}
                  onChange={(_, v) => this.setState({ editEmployeeNumbers: { ...editEmployeeNumbers, MobileNumber: v || '' } })}
                  placeholder="090-xxxx-xxxx" />
                <TextField label="Teams外線番号" value={editEmployeeNumbers.TeamsPhone}
                  onChange={(_, v) => this.setState({ editEmployeeNumbers: { ...editEmployeeNumbers, TeamsPhone: v || '' } })}
                  placeholder="050-xxxx-xxxx" />
              </Stack>
            ) : (
              <Stack tokens={{ childrenGap: 4 }}>
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                  <Label style={{ width: 100, fontSize: 12 }}>携帯番号</Label>
                  <span style={{ fontSize: 13 }}>{emp.MobileNumber || <span style={{ color: '#a19f9d' }}>未設定</span>}</span>
                </Stack>
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                  <Label style={{ width: 100, fontSize: 12 }}>Teams外線</Label>
                  <span style={{ fontSize: 13 }}>{emp.TeamsPhone || <span style={{ color: '#a19f9d' }}>未設定</span>}</span>
                </Stack>
              </Stack>
            )}
          </div>

          <Separator />

          {/* ===== 割当中SIM ===== */}
          <div style={{ background: '#f3f2f1', borderRadius: 6, padding: '12px 14px' }}>
            <Stack horizontal horizontalAlign="space-between" verticalAlign="center" style={{ marginBottom: 8 }}>
              <Text variant="mediumPlus" style={{ fontWeight: 600 }}>割当中SIM</Text>
              {editSimInPanel && simPanelMode === 'view' && (
                <Stack horizontal tokens={{ childrenGap: 6 }}>
                  <DefaultButton text="SIM情報を編集" iconProps={{ iconName: 'Edit' }} styles={{ root: { height: 24, fontSize: 11 } }}
                    onClick={() => this.setState({ simPanelMode: 'editSim' })} />
                  <DefaultButton text="SIMを差し替え" iconProps={{ iconName: 'Switch' }} styles={{ root: { height: 24, fontSize: 11 } }}
                    onClick={() => this.setState({ simPanelMode: 'replaceSim' })} />
                </Stack>
              )}
              {!editSimInPanel && simPanelMode === 'view' && (
                <DefaultButton text="SIMを割当" iconProps={{ iconName: 'Add' }} styles={{ root: { height: 24, fontSize: 11 } }}
                  onClick={() => this.setState({ simPanelMode: 'replaceSim' })} />
              )}
            </Stack>

            {simPanelMode === 'editSim' && editSimInPanel ? (
              <Stack tokens={{ childrenGap: 8 }}>
                <TextField label="SIM識別名" value={editSimInPanel.Title}
                  onChange={(_, v) => this.setState({ editSimInPanel: { ...editSimInPanel, Title: v || '' } })} />
                <TextField label="ICCID" value={editSimInPanel.ICCID || ''}
                  onChange={(_, v) => this.setState({ editSimInPanel: { ...editSimInPanel, ICCID: v || '' } })}
                  placeholder="8981100..." />
                <TextField label="電話番号（音声SIM/SMS付きのみ）" value={editSimInPanel.PhoneNo || ''}
                  onChange={(_, v) => this.setState({ editSimInPanel: { ...editSimInPanel, PhoneNo: v || '' } })}
                  placeholder="090-xxxx-xxxx" />
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                  <Dropdown label="キャリア" selectedKey={editSimInPanel.Carrier}
                    options={CARRIER_OPTIONS}
                    onChange={(_, o) => this.setState({ editSimInPanel: { ...editSimInPanel, Carrier: o?.key as any } })}
                    styles={{ root: { flex: 1 } }} />
                  <Dropdown label="回線網" selectedKey={editSimInPanel.Network || ''}
                    options={[{ key: '', text: '---' }, { key: 'docomo', text: 'docomo' }, { key: 'au', text: 'au' }, { key: 'SoftBank', text: 'SoftBank' }, { key: 'その他', text: 'その他' }]}
                    onChange={(_, o) => this.setState({ editSimInPanel: { ...editSimInPanel, Network: (o?.key as any) || undefined } })}
                    styles={{ root: { flex: 1 } }} />
                  <Dropdown label="SIM種別" selectedKey={editSimInPanel.SimType}
                    options={SIM_TYPE_OPTIONS}
                    onChange={(_, o) => this.setState({ editSimInPanel: { ...editSimInPanel, SimType: o?.key as any } })}
                    styles={{ root: { flex: 1 } }} />
                </Stack>
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                  <TextField label="プラン名" value={editSimInPanel.PlanName || ''}
                    onChange={(_, v) => this.setState({ editSimInPanel: { ...editSimInPanel, PlanName: v || '' } })}
                    styles={{ root: { flex: 1 } }} />
                  <TextField label="容量(GB)" type="number" value={editSimInPanel.DataSize?.toString() || ''}
                    onChange={(_, v) => this.setState({ editSimInPanel: { ...editSimInPanel, DataSize: v ? parseFloat(v) : undefined } })}
                    styles={{ root: { width: 80 } }} />
                  <TextField label="月額費用（円）" type="number" value={editSimInPanel.MonthlyCost?.toString() || ''}
                    onChange={(_, v) => this.setState({ editSimInPanel: { ...editSimInPanel, MonthlyCost: v ? parseInt(v) : undefined } })}
                    styles={{ root: { width: 100 } }} />
                </Stack>
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                  <TextField label="契約開始日" type="date" value={editSimInPanel.ContractDate?.substring(0, 10) || ''}
                    onChange={(_, v) => this.setState({ editSimInPanel: { ...editSimInPanel, ContractDate: v || '' } })}
                    styles={{ root: { flex: 1 } }} />
                  <Dropdown label="状態" selectedKey={editSimInPanel.Status}
                    options={SIM_STATUS_OPTIONS}
                    onChange={(_, o) => this.setState({ editSimInPanel: { ...editSimInPanel, Status: o?.key as any } })}
                    styles={{ root: { flex: 1 } }} />
                </Stack>
                <TextField label="備考" multiline rows={2} value={editSimInPanel.Remarks || ''}
                  onChange={(_, v) => this.setState({ editSimInPanel: { ...editSimInPanel, Remarks: v || '' } })} />
              </Stack>
            ) : simPanelMode === 'replaceSim' ? (
              <Stack tokens={{ childrenGap: 8 }}>
                <MessageBar messageBarType={MessageBarType.warning}>
                  {editSimInPanel ? '現在のSIMの割当を終了し、新しいSIMに差し替えます。' : '在庫から新しいSIMを割り当てます。'}
                </MessageBar>
                <Dropdown label="差し替えるSIM（在庫から選択）"
                  options={availableSims.map(s => ({
                    key: s.Id!,
                    text: `${s.Title} | ${s.Carrier} | ${s.SimType}${s.PhoneNo ? ' | ' + s.PhoneNo : ''}${s.PlanName ? ' | ' + s.PlanName : ''}`
                  }))}
                  onChange={(_, o) => o && this._replaceSimInPanel(o.key as number)}
                  placeholder="SIMを選択してください" />
                <DefaultButton text="キャンセル" onClick={() => this.setState({ simPanelMode: 'view' })} styles={{ root: { width: 100 } }} />
              </Stack>
            ) : editSimInPanel ? (
              // 表示モード
              <Stack tokens={{ childrenGap: 4 }}>
                {[
                  { label: 'SIM識別名', value: editSimInPanel.Title },
                  { label: 'ICCID', value: editSimInPanel.ICCID || '未登録' },
                  { label: '電話番号', value: editSimInPanel.PhoneNo || '（なし）' },
                  { label: 'キャリア', value: editSimInPanel.Carrier + (editSimInPanel.Network ? ` (${editSimInPanel.Network}回線)` : '') },
                  { label: 'SIM種別', value: editSimInPanel.SimType },
                  { label: 'プラン', value: editSimInPanel.PlanName || '未登録' },
                  { label: '容量', value: editSimInPanel.DataSize != null ? `${editSimInPanel.DataSize}GB` : '未登録' },
                  { label: '月額費用', value: editSimInPanel.MonthlyCost ? `¥${editSimInPanel.MonthlyCost.toLocaleString()}` : '未登録' },
                  { label: '契約開始日', value: editSimInPanel.ContractDate?.substring(0, 10) || '未登録' },
                  { label: '状態', value: editSimInPanel.Status },
                ].map(row => (
                  <Stack key={row.label} horizontal tokens={{ childrenGap: 8 }}>
                    <span style={{ width: 100, fontSize: 12, color: '#605e5c', flexShrink: 0 }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: row.label === 'キャリア' ? 600 : 400,
                      color: row.label === 'キャリア' ? (editSimInPanel.Carrier === 'KDDI' ? '#d83b01' : '#107c10') : '#323130' }}>
                      {row.value}
                    </span>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <span style={{ fontSize: 12, color: '#a19f9d' }}>SIMが割り当てられていません</span>
            )}
          </div>
        </Stack>
      </Panel>
    );
  }

  public render(): React.ReactElement {
    const { loading, error, searchText, filterDept, filterStatus, isPanelOpen, isAllocPanelOpen, isImportPanelOpen,
      editEmployee, editAllocation, selectedEmployee, sims, devices, saving } = this.state;
    const filtered = this._getFilteredEmployees();
    const { isAdmin } = this.props;

    const availableSims = sims.filter(s => s.Status === '在庫(未割当)');
    const availableDevices = devices.filter(d => d.Status === '在庫');

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
                <TextField label="携帯番号" value={editEmployee.MobileNumber || ''} onChange={(_, v) => this.setState({ editEmployee: { ...editEmployee, MobileNumber: v || '' } })} styles={{ root: { flex: 1 } }} />
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
                ]}
                onChange={(_, o) => this.setState({ editAllocation: { ...editAllocation, AllocationType: o?.key as any } })} />
              {(editAllocation.AllocationType === 'SIM+端末セット' || editAllocation.AllocationType === 'SIMのみ') && (
                <Dropdown label="SIM（在庫から選択）" selectedKey={editAllocation.SimId}
                  options={[
                    { key: undefined, text: '選択してください' },
                    ...availableSims.map(s => ({
                      key: s.Id,
                      text: `${s.Title} | ${s.Carrier} | ${s.SimType}${s.PhoneNo ? ' | ' + s.PhoneNo : ''}${s.PlanName ? ' | ' + s.PlanName : ''}`
                    }))
                  ]}
                  onChange={(_, o) => this.setState({ editAllocation: { ...editAllocation, SimId: o?.key as number } })} />
              )}
              {(editAllocation.AllocationType === 'SIM+端末セット' || editAllocation.AllocationType === '端末のみ') && (
                <Dropdown label="端末（在庫から選択）" selectedKey={editAllocation.DeviceId}
                  options={[{ key: undefined, text: '選択してください' }, ...availableDevices.map(d => ({ key: d.Id, text: `${d.DeviceModel} (IMEI: ${d.Title})` }))]}
                  onChange={(_, o) => this.setState({ editAllocation: { ...editAllocation, DeviceId: o?.key as number } })} />
              )}

              <TextField label="貸与開始日" type="date" value={editAllocation.StartDate?.substring(0, 10) || ''}
                onChange={(_, v) => this.setState({ editAllocation: { ...editAllocation, StartDate: v || '' } })} />
              <TextField label="特記事項" multiline rows={2} value={editAllocation.Notes || ''}
                onChange={(_, v) => this.setState({ editAllocation: { ...editAllocation, Notes: v || '' } })} />
            </Stack>
          )}
        </Panel>

        {/* SIM・番号管理パネル */}
        {this._renderSimPanel()}
      </div>
    );
  }
}
