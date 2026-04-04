import * as React from 'react';
import { Stack, Text, Spinner, SpinnerSize, MessageBar, MessageBarType } from '@fluentui/react';
import { IEmployee, ISim, IDevice, IPhoneNumber, IAllocation } from '../models/IModels';
import { SpService } from '../services/SpService';

interface IDashboardTabProps {
  spService: SpService;
}

interface IDashboardTabState {
  employees: IEmployee[];
  sims: ISim[];
  devices: IDevice[];
  phoneNumbers: IPhoneNumber[];
  allocations: IAllocation[];
  loading: boolean;
  error: string;
}

interface ISummaryCard {
  label: string;
  value: number | string;
  sub?: string;
  color: string;
  bgColor: string;
}

export class DashboardTab extends React.Component<IDashboardTabProps, IDashboardTabState> {
  constructor(props: IDashboardTabProps) {
    super(props);
    this.state = { employees: [], sims: [], devices: [], phoneNumbers: [], allocations: [], loading: true, error: '' };
  }

  public async componentDidMount(): Promise<void> {
    await this._loadData();
  }

  private async _loadData(): Promise<void> {
    this.setState({ loading: true, error: '' });
    try {
      const [employees, sims, devices, phoneNumbers, allocations] = await Promise.all([
        this.props.spService.getEmployees(),
        this.props.spService.getSims(),
        this.props.spService.getDevices(),
        this.props.spService.getPhoneNumbers(),
        this.props.spService.getAllocations(true),
      ]);
      this.setState({ employees, sims, devices, phoneNumbers, allocations, loading: false });
    } catch (e: any) {
      this.setState({ loading: false, error: `データ読み込みエラー: ${e.message}` });
    }
  }

  private _getDeptStats(): { dept: string; count: number }[] {
    const { employees, allocations } = this.state;
    const deptMap = new Map<string, number>();
    for (const emp of employees.filter(e => e.Status === '在籍')) {
      const hasAlloc = allocations.some(a => a.EmployeeId === emp.Id);
      if (hasAlloc) {
        deptMap.set(emp.Department, (deptMap.get(emp.Department) || 0) + 1);
      }
    }
    return Array.from(deptMap.entries()).map(([dept, count]) => ({ dept, count })).sort((a, b) => b.count - a.count);
  }

  private _renderSummaryCard(card: ISummaryCard): React.ReactElement {
    return (
      <div style={{ background: card.bgColor, border: `1px solid ${card.color}20`, borderRadius: 6, padding: '10px 16px', minWidth: 120, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: card.color, lineHeight: 1.2 }}>{card.value}</div>
        <div style={{ fontSize: 12, color: '#323130', marginTop: 2 }}>{card.label}</div>
        {card.sub && <div style={{ fontSize: 11, color: '#797775', marginTop: 2 }}>{card.sub}</div>}
      </div>
    );
  }

  private _renderBar(label: string, value: number, max: number, color: string): React.ReactElement {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
      <div style={{ marginBottom: 6 }}>
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
          <span style={{ fontSize: 12, width: 80, flexShrink: 0 }}>{label}</span>
          <div style={{ flex: 1, background: '#edebe9', borderRadius: 3, height: 14, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 12, color: '#605e5c', width: 30, textAlign: 'right' }}>{value}</span>
        </Stack>
      </div>
    );
  }

  public render(): React.ReactElement {
    const { loading, error, employees, sims, devices, phoneNumbers, allocations } = this.state;

    if (loading) return <Spinner size={SpinnerSize.medium} label="読み込み中..." style={{ marginTop: 32 }} />;
    if (error) return <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>;

    const activeEmployees = employees.filter(e => e.Status === '在籍').length;
    const allocatedEmployees = new Set(allocations.map(a => a.EmployeeId)).size;
    const inStockDevices = devices.filter(d => d.Status === '在庫').length;
    const inUseDevices = devices.filter(d => d.Status === '利用中').length;
    const inStockSims = sims.filter(s => s.Status === '在庫(未割当)').length;
    const inUseSims = sims.filter(s => s.Status === '利用中').length;
    const dataSims = sims.filter(s => s.SimType === 'データSIM').length;
    const voiceSims = sims.filter(s => s.SimType === '音声通話SIM(携帯)').length;
    const teamsNumbers = phoneNumbers.filter(p => p.NumberType === 'Teams外線').length;
    const teamsInUse = phoneNumbers.filter(p => p.NumberType === 'Teams外線' && p.Status === '利用中').length;
    const monthlyCost = sims.filter(s => s.Status === '利用中' && s.MonthlyCost).reduce((sum, s) => sum + (s.MonthlyCost || 0), 0);

    const deptStats = this._getDeptStats();
    const maxDeptCount = deptStats.length > 0 ? deptStats[0].count : 1;

    const summaryCards: ISummaryCard[] = [
      { label: '在籍社員', value: activeEmployees, sub: `機器割当済: ${allocatedEmployees}名`, color: '#0078d4', bgColor: '#eff6fc' },
      { label: '利用中端末', value: inUseDevices, sub: `在庫: ${inStockDevices}台`, color: '#107c10', bgColor: '#f1faf1' },
      { label: '利用中SIM', value: inUseSims, sub: `在庫: ${inStockSims}枚`, color: '#d83b01', bgColor: '#fdf6f3' },
      { label: 'Teams外線', value: teamsInUse, sub: `総数: ${teamsNumbers}番号`, color: '#5c2d91', bgColor: '#f4f0f9' },
      { label: '月額SIM費用', value: `¥${monthlyCost.toLocaleString()}`, sub: '利用中SIMの合計', color: '#605e5c', bgColor: '#f3f2f1' },
    ];

    return (
      <div style={{ padding: '8px 0' }}>
        {/* サマリーカード */}
        <Stack horizontal tokens={{ childrenGap: 8 }} wrap style={{ marginBottom: 20 }}>
          {summaryCards.map((card, i) => <div key={i}>{this._renderSummaryCard(card)}</div>)}
        </Stack>

        <Stack horizontal tokens={{ childrenGap: 24 }} wrap>
          {/* 部署別割当数 */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <Text variant="mediumPlus" style={{ fontWeight: 600, display: 'block', marginBottom: 10 }}>部署別 機器割当数</Text>
            {deptStats.length === 0 ? <span style={{ fontSize: 12, color: '#797775' }}>データなし</span> :
              deptStats.map(d => this._renderBar(d.dept, d.count, maxDeptCount, '#0078d4'))}
          </div>

          {/* SIM種別内訳 */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <Text variant="mediumPlus" style={{ fontWeight: 600, display: 'block', marginBottom: 10 }}>SIM種別内訳</Text>
            {this._renderBar('データSIM', dataSims, sims.length || 1, '#0078d4')}
            {this._renderBar('音声通話SIM', voiceSims, sims.length || 1, '#107c10')}
            <div style={{ marginTop: 12 }}>
              <Text variant="mediumPlus" style={{ fontWeight: 600, display: 'block', marginBottom: 10 }}>端末種別内訳</Text>
              {(['スマートフォン', 'タブレット', 'ルーター', 'その他'] as const).map(type => {
                const count = devices.filter(d => d.DeviceType === type).length;
                return count > 0 ? this._renderBar(type, count, devices.length || 1, '#d83b01') : null;
              })}
            </div>
          </div>

          {/* 電話番号種別 */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <Text variant="mediumPlus" style={{ fontWeight: 600, display: 'block', marginBottom: 10 }}>電話番号種別</Text>
            {(['スマホ(SIM紐付)', 'Teams外線', '固定電話', 'その他'] as const).map(type => {
              const count = phoneNumbers.filter(p => p.NumberType === type).length;
              const inUse = phoneNumbers.filter(p => p.NumberType === type && p.Status === '利用中').length;
              return count > 0 ? (
                <div key={type} style={{ marginBottom: 6 }}>
                  {this._renderBar(type.length > 8 ? type.substring(0, 8) + '…' : type, inUse, count, '#5c2d91')}
                  <span style={{ fontSize: 10, color: '#797775', marginLeft: 88 }}>利用中 {inUse} / 総数 {count}</span>
                </div>
              ) : null;
            })}
          </div>
        </Stack>
      </div>
    );
  }
}
