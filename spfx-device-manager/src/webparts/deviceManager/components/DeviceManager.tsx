import * as React from 'react';
import {
  Pivot, PivotItem, Stack, PrimaryButton, DefaultButton,
  MessageBar, MessageBarType, Spinner, SpinnerSize, Text,
} from '@fluentui/react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SpService } from '../services/SpService';
import { EmployeeTab } from './EmployeeTab';
import { AssetTab } from './AssetTab';
import { DashboardTab } from './DashboardTab';
import { HistoryTab } from './HistoryTab';
import { TabKey } from '../models/IModels';

export interface IDeviceManagerProps {
  context: WebPartContext;
  adminUsers: string;
}

interface IDeviceManagerState {
  activeTab: TabKey;
  isInitializing: boolean;
  initError: string;
  initSuccess: boolean;
  isAdmin: boolean;
}

export class DeviceManager extends React.Component<IDeviceManagerProps, IDeviceManagerState> {
  private spService: SpService;

  constructor(props: IDeviceManagerProps) {
    super(props);
    this.spService = new SpService(props.context);
    const currentUser = props.context.pageContext.user.loginName.toLowerCase();
    const adminList = (props.adminUsers || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    const isAdmin = adminList.length === 0 || adminList.some(a => currentUser.includes(a));

    this.state = {
      activeTab: 'employees',
      isInitializing: false,
      initError: '',
      initSuccess: false,
      isAdmin,
    };
  }

  private async _initializeLists(): Promise<void> {
    this.setState({ isInitializing: true, initError: '', initSuccess: false });
    try {
      await this.spService.initializeLists();
      this.setState({ isInitializing: false, initSuccess: true });
    } catch (e: any) {
      this.setState({ isInitializing: false, initError: `リスト初期化エラー: ${e.message}` });
    }
  }

  public render(): React.ReactElement {
    const { activeTab, isInitializing, initError, initSuccess, isAdmin } = this.state;

    return (
      <div style={{ fontFamily: "'Segoe UI', sans-serif", padding: '8px 12px', minHeight: 400 }}>
        {/* ヘッダー */}
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }} style={{ marginBottom: 8, borderBottom: '2px solid #0078d4', paddingBottom: 8 }}>
          <Text variant="xLarge" style={{ fontWeight: 700, color: '#0078d4' }}>通信機器・社員台帳 管理システム</Text>
          {isAdmin && (
            <DefaultButton
              text="リスト初期化"
              iconProps={{ iconName: 'Settings' }}
              onClick={() => this._initializeLists()}
              disabled={isInitializing}
              styles={{ root: { height: 28, fontSize: 12, marginLeft: 'auto' } }}
            />
          )}
        </Stack>

        {/* 初期化メッセージ */}
        {isInitializing && <Spinner size={SpinnerSize.small} label="SharePointリストを初期化中..." style={{ marginBottom: 8 }} />}
        {initError && <MessageBar messageBarType={MessageBarType.error} onDismiss={() => this.setState({ initError: '' })} style={{ marginBottom: 8 }}>{initError}</MessageBar>}
        {initSuccess && <MessageBar messageBarType={MessageBarType.success} onDismiss={() => this.setState({ initSuccess: false })} style={{ marginBottom: 8 }}>SharePointリストの初期化が完了しました。</MessageBar>}

        {/* メインタブ */}
        <Pivot onLinkClick={(item) => this.setState({ activeTab: item?.props.itemKey as TabKey || 'employees' })}>
          <PivotItem headerText="社員台帳" itemKey="employees" itemIcon="People" />
          <PivotItem headerText="在庫・資産" itemKey="assets" itemIcon="CellPhone" />
          <PivotItem headerText="ダッシュボード" itemKey="dashboard" itemIcon="BarChart4" />
          <PivotItem headerText="解約・履歴" itemKey="history" itemIcon="History" />
        </Pivot>

        {/* タブコンテンツ */}
        <div style={{ marginTop: 4 }}>
          {activeTab === 'employees' && <EmployeeTab spService={this.spService} isAdmin={isAdmin} />}
          {activeTab === 'assets' && <AssetTab spService={this.spService} isAdmin={isAdmin} />}
          {activeTab === 'dashboard' && <DashboardTab spService={this.spService} />}
          {activeTab === 'history' && <HistoryTab spService={this.spService} />}
        </div>
      </div>
    );
  }
}
