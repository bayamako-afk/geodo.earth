import * as React from 'react';
import {
  DetailsList, DetailsListLayoutMode, SelectionMode, IColumn,
  SearchBox, PrimaryButton, DefaultButton, Panel, PanelType,
  TextField, Dropdown, Stack, Pivot, PivotItem,
  MessageBar, MessageBarType, Spinner, SpinnerSize, IconButton, TooltipHost,
} from '@fluentui/react';
import { ISim, IDevice, AssetTabKey } from '../models/IModels';
import { SpService } from '../services/SpService';
import { ExcelExportService } from '../services/ExcelExportService';
import { ImportPanel, ImportType } from './ImportPanel';

interface IAssetTabProps {
  spService: SpService;
  isAdmin: boolean;
}

interface IAssetTabState {
  sims: ISim[];
  devices: IDevice[];
  loading: boolean;
  searchText: string;
  activeAssetTab: AssetTabKey;
  isPanelOpen: boolean;
  editSim: ISim | null;
  editDevice: IDevice | null;
  error: string;
  saving: boolean;
  isImportOpen: boolean;
}

export class AssetTab extends React.Component<IAssetTabProps, IAssetTabState> {
  constructor(props: IAssetTabProps) {
    super(props);
    this.state = {
      sims: [], devices: [],
      loading: true, searchText: '', activeAssetTab: 'devices',
      isPanelOpen: false, editSim: null, editDevice: null,
      error: '', saving: false, isImportOpen: false,
    };
  }

  public async componentDidMount(): Promise<void> {
    await this._loadData();
  }

  private async _loadData(): Promise<void> {
    this.setState({ loading: true, error: '' });
    try {
      const [sims, devices] = await Promise.all([
        this.props.spService.getSims(),
        this.props.spService.getDevices(),
      ]);
      this.setState({ sims, devices, loading: false });
    } catch (e: any) {
      this.setState({ loading: false, error: `データ読み込みエラー: ${e.message}` });
    }
  }

  // ---- 端末一覧 ----
  private _getDeviceColumns(): IColumn[] {
    return [
      { key: 'model', name: '機種名', fieldName: 'DeviceModel', minWidth: 120, maxWidth: 180, isResizable: true },
      { key: 'type', name: '種別', fieldName: 'DeviceType', minWidth: 80, maxWidth: 100, isResizable: true },
      { key: 'imei', name: 'IMEI', fieldName: 'Title', minWidth: 130, maxWidth: 160, isResizable: true,
        onRender: (item: IDevice) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.Title}</span> },
      { key: 'sn', name: 'S/N', fieldName: 'SerialNumber', minWidth: 110, maxWidth: 140, isResizable: true,
        onRender: (item: IDevice) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.SerialNumber || '-'}</span> },
      { key: 'status', name: '状態', fieldName: 'Status', minWidth: 60, maxWidth: 80, isResizable: true,
        onRender: (item: IDevice) => <span style={{ color: this._deviceStatusColor(item.Status), fontWeight: 600, fontSize: 12 }}>{item.Status}</span> },
      { key: 'purchase', name: '購入日', minWidth: 80, maxWidth: 100, isResizable: true,
        onRender: (item: IDevice) => <span style={{ fontSize: 11 }}>{item.PurchaseDate?.substring(0, 10) || '-'}</span> },
      ...(this.props.isAdmin ? [{ key: 'actions', name: '操作', minWidth: 60, maxWidth: 80,
        onRender: (item: IDevice) => (
          <TooltipHost content="編集">
            <IconButton iconProps={{ iconName: 'Edit' }} onClick={() => this.setState({ editDevice: { ...item }, isPanelOpen: true })} styles={{ root: { height: 24 } }} />
          </TooltipHost>
        )}] : []),
    ];
  }

  private _deviceStatusColor(s: string): string {
    return s === '利用中' ? '#0078d4' : s === '在庫' ? '#107c10' : s === '故障' ? '#d83b01' : '#a4262c';
  }

  // ---- SIM一覧 ----
  private _getSimColumns(): IColumn[] {
    return [
      { key: 'title', name: 'SIM識別名', fieldName: 'Title', minWidth: 90, maxWidth: 120, isResizable: true,
        onRender: (item: ISim) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.Title}</span> },
      { key: 'iccid', name: 'ICCID', fieldName: 'ICCID', minWidth: 140, maxWidth: 180, isResizable: true,
        onRender: (item: ISim) => <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#605e5c' }}>{item.ICCID || '-'}</span> },
      { key: 'phoneno', name: '電話番号', fieldName: 'PhoneNo', minWidth: 110, maxWidth: 140, isResizable: true,
        onRender: (item: ISim) => <span style={{ fontSize: 11, color: '#0078d4' }}>{item.PhoneNo || '-'}</span> },
      { key: 'carrier', name: 'キャリア', fieldName: 'Carrier', minWidth: 80, maxWidth: 100, isResizable: true,
        onRender: (item: ISim) => <span style={{ fontWeight: 600, color: item.Carrier === 'KDDI' ? '#d83b01' : item.Carrier === 'HISモバイル' ? '#107c10' : '#605e5c', fontSize: 12 }}>{item.Carrier}</span> },
      { key: 'type', name: 'SIM種別', fieldName: 'SimType', minWidth: 110, maxWidth: 140, isResizable: true,
        onRender: (item: ISim) => {
          const color = item.SimType === '音声SIM' ? '#107c10' : item.SimType === 'SMS付きデータSIM' ? '#5c2d91' : '#0078d4';
          return <span style={{ color, fontSize: 12 }}>{item.SimType}</span>;
        } },
      { key: 'plan', name: 'プラン', fieldName: 'PlanName', minWidth: 100, maxWidth: 140, isResizable: true },
      { key: 'cost', name: '月額', minWidth: 60, maxWidth: 80, isResizable: true,
        onRender: (item: ISim) => <span style={{ fontSize: 11 }}>{item.MonthlyCost ? `¥${item.MonthlyCost.toLocaleString()}` : '-'}</span> },
      { key: 'contract', name: '契約開始', minWidth: 80, maxWidth: 100, isResizable: true,
        onRender: (item: ISim) => <span style={{ fontSize: 11 }}>{item.ContractDate?.substring(0, 10) || '-'}</span> },
      { key: 'status', name: '状態', fieldName: 'Status', minWidth: 80, maxWidth: 100, isResizable: true,
        onRender: (item: ISim) => <span style={{ color: this._simStatusColor(item.Status), fontWeight: 600, fontSize: 12 }}>{item.Status}</span> },
      ...(this.props.isAdmin ? [{ key: 'actions', name: '操作', minWidth: 60, maxWidth: 80,
        onRender: (item: ISim) => (
          <TooltipHost content="編集">
            <IconButton iconProps={{ iconName: 'Edit' }} onClick={() => this.setState({ editSim: { ...item }, isPanelOpen: true })} styles={{ root: { height: 24 } }} />
          </TooltipHost>
        )}] : []),
    ];
  }

  private _simStatusColor(s: string): string {
    return s === '利用中' ? '#0078d4' : s === '在庫(未割当)' ? '#107c10' : s === '解約済' ? '#797775' : '#a4262c';
  }

  private _getFilteredItems(): any[] {
    const { sims, devices, searchText, activeAssetTab } = this.state;
    const q = searchText.toLowerCase();
    if (activeAssetTab === 'devices') {
      return devices.filter(d => !q || [d.Title, d.SerialNumber, d.DeviceModel, d.DeviceType, d.Status].join(' ').toLowerCase().includes(q));
    } else {
      return sims.filter(s => !q || [s.Title, s.ICCID, s.PhoneNo, s.Carrier, s.SimType, s.PlanName, s.Status].join(' ').toLowerCase().includes(q));
    }
  }

  private async _saveDevice(): Promise<void> {
    const { editDevice } = this.state;
    if (!editDevice) return;
    this.setState({ saving: true });
    try {
      await this.props.spService.saveDevice(editDevice);
      this.setState({ isPanelOpen: false, editDevice: null, saving: false });
      await this._loadData();
    } catch (e: any) {
      this.setState({ error: `保存エラー: ${e.message}`, saving: false });
    }
  }

  private async _saveSim(): Promise<void> {
    const { editSim } = this.state;
    if (!editSim) return;
    this.setState({ saving: true });
    try {
      await this.props.spService.saveSim(editSim);
      this.setState({ isPanelOpen: false, editSim: null, saving: false });
      await this._loadData();
    } catch (e: any) {
      this.setState({ error: `保存エラー: ${e.message}`, saving: false });
    }
  }

  private _openNewPanel(): void {
    const { activeAssetTab } = this.state;
    if (activeAssetTab === 'devices') {
      this.setState({ editDevice: { Title: '', DeviceModel: '', DeviceType: 'スマートフォン', Status: '在庫' }, isPanelOpen: true });
    } else {
      this.setState({ editSim: { Title: '', Carrier: 'KDDI', SimType: '音声SIM', Status: '在庫(未割当)' }, isPanelOpen: true });
    }
  }

  private _getPanelTitle(): string {
    const { activeAssetTab, editDevice, editSim } = this.state;
    if (activeAssetTab === 'devices') return editDevice?.Id ? '端末を編集' : '端末を新規登録';
    return editSim?.Id ? 'SIMを編集' : 'SIMを新規登録';
  }

  private _handleSave(): void {
    const { activeAssetTab } = this.state;
    if (activeAssetTab === 'devices') this._saveDevice();
    else this._saveSim();
  }

  private _getImportType(): ImportType {
    return this.state.activeAssetTab === 'devices' ? 'device' : 'sim';
  }

  public render(): React.ReactElement {
    const { loading, error, searchText, activeAssetTab, isPanelOpen, editDevice, editSim, saving, isImportOpen } = this.state;
    const filtered = this._getFilteredItems();
    const { isAdmin } = this.props;

    return (
      <div style={{ padding: '8px 0' }}>
        {error && <MessageBar messageBarType={MessageBarType.error} onDismiss={() => this.setState({ error: '' })}>{error}</MessageBar>}

        <Pivot onLinkClick={(item) => this.setState({ activeAssetTab: item?.props.itemKey as AssetTabKey || 'devices', searchText: '' })}>
          <PivotItem headerText="端末" itemKey="devices" itemIcon="CellPhone" />
          <PivotItem headerText="SIM" itemKey="sims" itemIcon="Sim" />
        </Pivot>

        <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center" style={{ margin: '8px 0' }}>
          <SearchBox placeholder="検索..." value={searchText}
            onChange={(_, v) => this.setState({ searchText: v || '' })} style={{ width: 240 }} />
          <span style={{ color: '#605e5c', fontSize: 12 }}>{filtered.length}件</span>
          {isAdmin && (
            <PrimaryButton text="新規登録" iconProps={{ iconName: 'Add' }} onClick={() => this._openNewPanel()} styles={{ root: { height: 28, fontSize: 12 } }} />
          )}
          {isAdmin && (
            <DefaultButton
              text={`Excelインポート`}
              iconProps={{ iconName: 'Upload' }}
              onClick={() => this.setState({ isImportOpen: true })}
              styles={{ root: { height: 28, fontSize: 12 } }}
            />
          )}
          <DefaultButton text="Excelエクスポート" iconProps={{ iconName: 'ExcelDocument' }}
            onClick={() => ExcelExportService.exportAssetList(filtered, activeAssetTab, activeAssetTab)} styles={{ root: { height: 28, fontSize: 12 } }} />
          <DefaultButton text="更新" iconProps={{ iconName: 'Refresh' }} onClick={() => this._loadData()} styles={{ root: { height: 28, fontSize: 12 } }} />
        </Stack>

        {loading ? <Spinner size={SpinnerSize.medium} label="読み込み中..." /> : (
          <DetailsList
            items={filtered}
            columns={activeAssetTab === 'devices' ? this._getDeviceColumns() : this._getSimColumns()}
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none}
            compact={true}
          />
        )}

        {/* Excelインポートパネル */}
        <ImportPanel
          isOpen={isImportOpen}
          spService={this.props.spService}
          defaultImportType={this._getImportType()}
          onDismiss={() => this.setState({ isImportOpen: false })}
          onImported={() => { this.setState({ isImportOpen: false }); this._loadData(); }}
        />

        {/* 編集パネル */}
        <Panel isOpen={isPanelOpen} type={PanelType.medium} headerText={this._getPanelTitle()}
          onDismiss={() => this.setState({ isPanelOpen: false, editDevice: null, editSim: null })}
          onRenderFooterContent={() => (
            <Stack horizontal tokens={{ childrenGap: 8 }}>
              <PrimaryButton text="保存" onClick={() => this._handleSave()} disabled={saving} />
              <DefaultButton text="キャンセル" onClick={() => this.setState({ isPanelOpen: false })} />
            </Stack>
          )} isFooterAtBottom>

          {/* 端末フォーム */}
          {activeAssetTab === 'devices' && editDevice && (
            <Stack tokens={{ childrenGap: 12 }} style={{ padding: '16px 0' }}>
              <TextField label="IMEI *" value={editDevice.Title} onChange={(_, v) => this.setState({ editDevice: { ...editDevice, Title: v || '' } })} required />
              <TextField label="シリアル番号(S/N)" value={editDevice.SerialNumber || ''} onChange={(_, v) => this.setState({ editDevice: { ...editDevice, SerialNumber: v || '' } })} />
              <TextField label="機種名 *" value={editDevice.DeviceModel} onChange={(_, v) => this.setState({ editDevice: { ...editDevice, DeviceModel: v || '' } })} required />
              <Dropdown label="端末種別" selectedKey={editDevice.DeviceType}
                options={[{ key: 'スマートフォン', text: 'スマートフォン' }, { key: 'タブレット', text: 'タブレット' }, { key: 'ルーター', text: 'ルーター' }, { key: 'その他', text: 'その他' }]}
                onChange={(_, o) => this.setState({ editDevice: { ...editDevice, DeviceType: o?.key as any } })} />
              <Dropdown label="状態" selectedKey={editDevice.Status}
                options={[{ key: '利用中', text: '利用中' }, { key: '在庫', text: '在庫' }, { key: '故障', text: '故障' }, { key: '廃棄', text: '廃棄' }]}
                onChange={(_, o) => this.setState({ editDevice: { ...editDevice, Status: o?.key as any } })} />
              <TextField label="購入日" type="date" value={editDevice.PurchaseDate?.substring(0, 10) || ''} onChange={(_, v) => this.setState({ editDevice: { ...editDevice, PurchaseDate: v || '' } })} />
              <TextField label="備考" multiline rows={2} value={editDevice.Remarks || ''} onChange={(_, v) => this.setState({ editDevice: { ...editDevice, Remarks: v || '' } })} />
            </Stack>
          )}

          {/* SIMフォーム */}
          {activeAssetTab === 'sims' && editSim && (
            <Stack tokens={{ childrenGap: 12 }} style={{ padding: '16px 0' }}>
              <TextField label="SIM識別名 *" value={editSim.Title} onChange={(_, v) => this.setState({ editSim: { ...editSim, Title: v || '' } })} required placeholder="例: KDDI-001, HIS-001" />
              <TextField label="ICCID" value={editSim.ICCID || ''} onChange={(_, v) => this.setState({ editSim: { ...editSim, ICCID: v || '' } })} placeholder="SIM カードの識別番号" />
              <TextField label="電話番号" value={editSim.PhoneNo || ''} onChange={(_, v) => this.setState({ editSim: { ...editSim, PhoneNo: v || '' } })} placeholder="音声SIMのみ。データSIMは空欄" />
              <Dropdown label="通信キャリア" selectedKey={editSim.Carrier}
                options={[{ key: 'KDDI', text: 'KDDI' }, { key: 'HISモバイル', text: 'HISモバイル' }, { key: 'docomo', text: 'docomo' }, { key: 'SoftBank', text: 'SoftBank' }, { key: 'その他', text: 'その他' }]}
                onChange={(_, o) => this.setState({ editSim: { ...editSim, Carrier: o?.key as any } })} />
              <Dropdown label="SIM種別" selectedKey={editSim.SimType}
                options={[{ key: '音声SIM', text: '音声SIM' }, { key: 'SMS付きデータSIM', text: 'SMS付きデータSIM' }, { key: 'データSIM', text: 'データSIM' }]}
                onChange={(_, o) => this.setState({ editSim: { ...editSim, SimType: o?.key as any } })} />
              <TextField label="契約プラン名" value={editSim.PlanName || ''} onChange={(_, v) => this.setState({ editSim: { ...editSim, PlanName: v || '' } })} />
              <TextField label="月額費用 (円)" type="number" value={editSim.MonthlyCost?.toString() || ''} onChange={(_, v) => this.setState({ editSim: { ...editSim, MonthlyCost: v ? parseInt(v) : undefined } })} />
              <TextField label="契約開始日" type="date" value={editSim.ContractDate?.substring(0, 10) || ''} onChange={(_, v) => this.setState({ editSim: { ...editSim, ContractDate: v || '' } })} />
              <Dropdown label="状態" selectedKey={editSim.Status}
                options={[{ key: '利用中', text: '利用中' }, { key: '在庫(未割当)', text: '在庫(未割当)' }, { key: '解約済', text: '解約済' }, { key: '紛失', text: '紛失' }]}
                onChange={(_, o) => this.setState({ editSim: { ...editSim, Status: o?.key as any } })} />
              <TextField label="備考" multiline rows={2} value={editSim.Remarks || ''} onChange={(_, v) => this.setState({ editSim: { ...editSim, Remarks: v || '' } })} />
            </Stack>
          )}
        </Panel>
      </div>
    );
  }
}
