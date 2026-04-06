// ============================================================
// 従業員・通信機器 統合管理システム - データモデル定義
// ============================================================

export interface IEmployee {
  Id?: number;
  Title: string;              // 社員番号 (A0012形式)
  EmployeeName: string;       // 氏名
  Department: string;         // 部署
  JobTitle?: string;          // 役職
  MobileNumber?: string;      // 携帯番号
  TeamsPhone?: string;        // Teams外線番号
  Email?: string;             // メールアドレス
  HibinoEmployeeNo?: string;  // HIBINO社員番号
  Status: '在籍' | '休職' | '退職';
  JoinDate?: string;          // 入社日
  LeaveDate?: string;         // 退社日
  Remarks?: string;
}

export interface ISim {
  Id?: number;
  Title: string;           // SIM識別名（例: KDDI-001, HIS-001）
  ICCID?: string;          // SIM識別番号（ICCIDまたはIMSI）
  PhoneNo?: string;        // 電話番号（音声SIM/SMS付きSIMのみ。データSIMは空欄）
  Carrier: 'KDDI' | 'HISモバイル' | 'docomo' | 'SoftBank' | 'その他';
  SimType: '音声' | 'SMS付データ' | 'データ';
  PlanName?: string;       // 契約プラン名
  DataSize?: number;       // データ容量（GB）
  MonthlyCost?: number;    // 月額費用（円）
  ContractDate?: string;   // 契約開始日
  Status: '利用中' | '在庫(未割当)' | '解約済' | '紛失';
  Remarks?: string;
}

export interface IDevice {
  Id?: number;
  Title: string;           // IMEI
  SerialNumber?: string;   // シリアル番号(S/N)
  DeviceModel: string;     // 機種名
  DeviceType: 'スマートフォン' | 'タブレット' | 'ルーター' | 'その他';
  Status: '利用中' | '在庫' | '故障' | '廃棄';
  PurchaseDate?: string;
  Remarks?: string;
}

export interface IAllocation {
  Id?: number;
  Title: string;           // 割当ID
  EmployeeId: number;
  EmployeeName?: string;   // 表示用
  Department?: string;     // 表示用
  AllocationType: 'SIM+端末セット' | '端末のみ' | 'SIMのみ';
  SimId?: number;
  SimTitle?: string;       // 表示用
  DeviceId?: number;
  DeviceModel?: string;    // 表示用
  StartDate: string;
  EndDate?: string;
  IsCurrent: boolean;
  Notes?: string;
}

// 社員台帳ビュー用（結合済みデータ）
export interface IEmployeeView extends IEmployee {
  allocations: IAllocationView[];
}

export interface IAllocationView extends IAllocation {
  simInfo?: ISim;
  deviceInfo?: IDevice;
}

export type TabKey = 'employees' | 'assets' | 'dashboard' | 'history';
export type AssetTabKey = 'devices' | 'sims';
