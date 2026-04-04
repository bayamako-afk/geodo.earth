import * as React from 'react';
import {
  DetailsList, DetailsListLayoutMode, SelectionMode, IColumn,
  SearchBox, DefaultButton, Stack, Pivot, PivotItem,
  MessageBar, MessageBarType, Spinner, SpinnerSize,
} from '@fluentui/react';
import { IEmployee, ISim, IDevice, IAllocation } from '../models/IModels';
import { SpService } from '../services/SpService';

interface IHistoryTabProps {
  spService: SpService;
}

interface IHistoryTabState {
  retiredEmployees: IEmployee[];
  cancelledSims: ISim[];
  disposedDevices: IDevice[];
  allAllocations: IAllocation[];
  employees: IEmployee[];
  sims: ISim[];
  devices: IDevice[];
  loading: boolean;
  searchText: string;
  error: string;
}

export class HistoryTab extends React.Component<IHistoryTabProps, IHistoryTabState> {
  constructor(props: IHistoryTabProps) {
    super(props);
    this.state = {
      retiredEmployees: [], cancelledSims: [], disposedDevices: [],
      allAllocations: [], employees: [], sims: [], devices: [],
      loading: true, searchText: '', error: '',
    };
  }

  public async componentDidMount(): Promise<void> {
    await this._loadData();
  }

  private async _loadData(): Promise<void> {
    this.setState({ loading: true, error: '' });
    try {
      const [employees, sims, devices, allocations] = await Promise.all([
        this.props.spService.getEmployees(),
        this.props.spService.getSims(),
        this.props.spService.getDevices(),
        this.props.spService.getAllocations(false),
      ]);
      this.setState({
        retiredEmployees: employees.filter(e => e.Status === '退職'),
        cancelledSims: sims.filter(s => s.Status === '解約済' || s.Status === '紛失'),
        disposedDevices: devices.filter(d => d.Status === '廃棄' || d.Status === '故障'),
        allAllocations: allocations.filter(a => !a.IsCurrent),
        employees, sims, devices,
        loading: false,
      });
    } catch (e: any) {
      this.setState({ loading: false, error: `データ読み込みエラー: ${e.message}` });
    }
  }

  private _getRetiredColumns(): IColumn[] {
    return [
      { key: 'id', name: '従業員番号', fieldName: 'Title', minWidth: 90, maxWidth: 110 },
      { key: 'name', name: '氏名', fieldName: 'EmployeeName', minWidth: 80, maxWidth: 120 },
      { key: 'dept', name: '部署', fieldName: 'Department', minWidth: 70, maxWidth: 100 },
      { key: 'status', name: '状態', fieldName: 'Status', minWidth: 60, maxWidth: 80,
        onRender: (item: IEmployee) => <span style={{ color: '#a4262c', fontWeight: 600, fontSize: 12 }}>{item.Status}</span> },
      { key: 'leave', name: '退社日', minWidth: 80, maxWidth: 100,
        onRender: (item: IEmployee) => <span style={{ fontSize: 11 }}>{item.LeaveDate?.substring(0, 10) || '-'}</span> },
    ];
  }

  private _getCancelledSimColumns(): IColumn[] {
    return [
      { key: 'iccid', name: 'SIM識別番号', fieldName: 'Title', minWidth: 140, maxWidth: 180,
        onRender: (item: ISim) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.Title}</span> },
      { key: 'carrier', name: 'キャリア', fieldName: 'Carrier', minWidth: 70, maxWidth: 90 },
      { key: 'type', name: 'SIM種別', fieldName: 'SimType', minWidth: 100, maxWidth: 130 },
      { key: 'status', name: '状態', fieldName: 'Status', minWidth: 60, maxWidth: 80,
        onRender: (item: ISim) => <span style={{ color: item.Status === '紛失' ? '#a4262c' : '#797775', fontWeight: 600, fontSize: 12 }}>{item.Status}</span> },
    ];
  }

  private _getDisposedDeviceColumns(): IColumn[] {
    return [
      { key: 'model', name: '機種名', fieldName: 'DeviceModel', minWidth: 120, maxWidth: 180 },
      { key: 'imei', name: 'IMEI', fieldName: 'Title', minWidth: 130, maxWidth: 160,
        onRender: (item: IDevice) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.Title}</span> },
      { key: 'status', name: '状態', fieldName: 'Status', minWidth: 60, maxWidth: 80,
        onRender: (item: IDevice) => <span style={{ color: item.Status === '廃棄' ? '#797775' : '#d83b01', fontWeight: 600, fontSize: 12 }}>{item.Status}</span> },
    ];
  }

  private _getAllocHistoryColumns(): IColumn[] {
    const { employees, sims, devices } = this.state;
    const empMap = new Map(employees.map(e => [e.Id!, e]));
    const simMap = new Map(sims.map(s => [s.Id!, s]));
    const deviceMap = new Map(devices.map(d => [d.Id!, d]));
    return [
      { key: 'emp', name: '利用者', minWidth: 80, maxWidth: 120,
        onRender: (item: IAllocation) => { const e = empMap.get(item.EmployeeId); return <span style={{ fontSize: 12 }}>{e ? `${e.EmployeeName} (${e.Department})` : item.EmployeeId}</span>; } },
      { key: 'type', name: '割当種別', fieldName: 'AllocationType', minWidth: 100, maxWidth: 130 },
      { key: 'sim', name: 'SIM', minWidth: 120, maxWidth: 150,
        onRender: (item: IAllocation) => { const s = item.SimId ? simMap.get(item.SimId) : null; return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{s ? s.Title : '-'}</span>; } },
      { key: 'device', name: '端末', minWidth: 100, maxWidth: 140,
        onRender: (item: IAllocation) => { const d = item.DeviceId ? deviceMap.get(item.DeviceId) : null; return <span style={{ fontSize: 11 }}>{d ? d.DeviceModel : '-'}</span>; } },
      { key: 'start', name: '開始日', minWidth: 80, maxWidth: 100,
        onRender: (item: IAllocation) => <span style={{ fontSize: 11 }}>{item.StartDate?.substring(0, 10) || '-'}</span> },
      { key: 'end', name: '終了日', minWidth: 80, maxWidth: 100,
        onRender: (item: IAllocation) => <span style={{ fontSize: 11 }}>{item.EndDate?.substring(0, 10) || '-'}</span> },
    ];
  }

  public render(): React.ReactElement {
    const { loading, error, retiredEmployees, cancelledSims, disposedDevices, allAllocations, searchText } = this.state;
    const q = searchText.toLowerCase();

    return (
      <div style={{ padding: '8px 0' }}>
        {error && <MessageBar messageBarType={MessageBarType.error} onDismiss={() => this.setState({ error: '' })}>{error}</MessageBar>}

        <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center" style={{ marginBottom: 8 }}>
          <SearchBox placeholder="検索..." value={searchText} onChange={(_, v) => this.setState({ searchText: v || '' })} style={{ width: 240 }} />
          <DefaultButton text="更新" iconProps={{ iconName: 'Refresh' }} onClick={() => this._loadData()} styles={{ root: { height: 28, fontSize: 12 } }} />
        </Stack>

        {loading ? <Spinner size={SpinnerSize.medium} label="読み込み中..." /> : (
          <Pivot>
            <PivotItem headerText={`退職者 (${retiredEmployees.length})`} itemKey="retired" itemIcon="Leave">
              <DetailsList items={retiredEmployees.filter(e => !q || [e.EmployeeName, e.Title, e.Department].join(' ').toLowerCase().includes(q))}
                columns={this._getRetiredColumns()} layoutMode={DetailsListLayoutMode.justified} selectionMode={SelectionMode.none} compact={true} />
            </PivotItem>
            <PivotItem headerText={`解約済SIM (${cancelledSims.length})`} itemKey="sims" itemIcon="Sim">
              <DetailsList items={cancelledSims.filter(s => !q || [s.Title, s.Carrier, s.Status].join(' ').toLowerCase().includes(q))}
                columns={this._getCancelledSimColumns()} layoutMode={DetailsListLayoutMode.justified} selectionMode={SelectionMode.none} compact={true} />
            </PivotItem>
            <PivotItem headerText={`廃棄・故障端末 (${disposedDevices.length})`} itemKey="devices" itemIcon="CellPhone">
              <DetailsList items={disposedDevices.filter(d => !q || [d.Title, d.DeviceModel, d.Status].join(' ').toLowerCase().includes(q))}
                columns={this._getDisposedDeviceColumns()} layoutMode={DetailsListLayoutMode.justified} selectionMode={SelectionMode.none} compact={true} />
            </PivotItem>
            <PivotItem headerText={`割当履歴 (${allAllocations.length})`} itemKey="history" itemIcon="History">
              <DetailsList items={allAllocations} columns={this._getAllocHistoryColumns()} layoutMode={DetailsListLayoutMode.justified} selectionMode={SelectionMode.none} compact={true} />
            </PivotItem>
          </Pivot>
        )}
      </div>
    );
  }
}
