// ============================================================
// 従業員・通信機器・電話番号 統合管理システム - データモデル定義
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

export interface IPhoneNumber {
  Id?: number;
  Title: string;           // 電話番号
  NumberType: 'スマホ(SIM紐付)' | 'Teams外線' | '固定電話' | 'その他';
  Carrier: string;         // キャリア/プロバイダ
  Status: '利用中' | '空き(未割当)' | '解約済';
  Remarks?: string;
}

export interface ISim {
  Id?: number;
  Title: string;           // SIM識別番号 (ICCID等)
  PhoneNumberId?: number;  // 電話番号参照
  PhoneNumberTitle?: string; // 表示用
  Carrier: string;
  PlanName?: string;
  SimType: 'データSIM' | '音声通話SIM(携帯)';
  Status: '利用中' | '在庫(未割当)' | '解約済' | '紛失';
  MonthlyCost?: number;
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
  AllocationType: 'SIM+端末セット' | '端末のみ' | 'SIMのみ' | 'Teams外線のみ';
  SimId?: number;
  SimTitle?: string;       // 表示用
  DeviceId?: number;
  DeviceModel?: string;    // 表示用
  PhoneNumberId?: number;
  PhoneNumber?: string;    // 表示用
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
  phoneNumberInfo?: IPhoneNumber;
}

export type TabKey = 'employees' | 'assets' | 'dashboard' | 'history';
export type AssetTabKey = 'devices' | 'sims' | 'phoneNumbers';
