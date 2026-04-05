import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IEmployee, IPhoneNumber, ISim, IDevice, IAllocation } from '../models/IModels';

// ============================================================
// SharePoint REST API サービス
// ============================================================

const LISTS = {
  EMPLOYEE: 'Employee_Master',
  PHONE_NUMBER: 'PhoneNumber_Master',
  SIM: 'SIM_Master',
  DEVICE: 'Device_Master',
  ALLOCATION: 'Asset_Allocation',
};

export class SpService {
  private context: WebPartContext;
  private siteUrl: string;

  constructor(context: WebPartContext) {
    this.context = context;
    this.siteUrl = context.pageContext.web.absoluteUrl;
  }

  // ============================================================
  // リスト初期化
  // ============================================================
  public async initializeLists(): Promise<void> {
    await this._ensureList(LISTS.EMPLOYEE, '従業員マスタ（社員台帳）', [
      { name: 'EmployeeName', type: 'Text', title: '氏名' },
      { name: 'Department', type: 'Choice', title: '部署', choices: ['代表取締役社長', '取締役', '管理部', '開発部', 'BSI事業部', 'VS事業部', 'その他'] },
      { name: 'JobTitle', type: 'Text', title: '役職' },
      { name: 'MobileNumber', type: 'Text', title: '携帯番号' },
      { name: 'TeamsPhone', type: 'Text', title: 'Teams外線番号' },
      { name: 'Email', type: 'Text', title: 'メールアドレス' },
      { name: 'HibinoEmployeeNo', type: 'Text', title: 'HIBINO社員番号' },
      { name: 'Status', type: 'Choice', title: '在籍状況', choices: ['在籍', '休職', '退職'] },
      { name: 'JoinDate', type: 'DateTime', title: '入社日' },
      { name: 'LeaveDate', type: 'DateTime', title: '退社日' },
      { name: 'Remarks', type: 'Note', title: '備考' },
    ]);

    await this._ensureList(LISTS.PHONE_NUMBER, '電話番号マスタ', [
      { name: 'NumberType', type: 'Choice', title: '番号種別', choices: ['スマホ(SIM紐付)', 'Teams外線', '固定電話', 'その他'] },
      { name: 'Carrier', type: 'Choice', title: 'キャリア/プロバイダ', choices: ['docomo', 'au', 'SoftBank', 'Microsoft', 'その他'] },
      { name: 'Status', type: 'Choice', title: '状態', choices: ['利用中', '空き(未割当)', '解約済'] },
      { name: 'Remarks', type: 'Note', title: '備考' },
    ]);

    await this._ensureList(LISTS.SIM, 'SIMマスタ', [
      { name: 'PhoneNumberId', type: 'Number', title: '電話番号参照ID' },
      { name: 'Carrier', type: 'Choice', title: '通信キャリア', choices: ['docomo', 'au', 'SoftBank', 'その他'] },
      { name: 'PlanName', type: 'Text', title: '契約プラン名' },
      { name: 'SimType', type: 'Choice', title: 'SIM種別', choices: ['データSIM', '音声通話SIM(携帯)'] },
      { name: 'Status', type: 'Choice', title: '状態', choices: ['利用中', '在庫(未割当)', '解約済', '紛失'] },
      { name: 'MonthlyCost', type: 'Number', title: '月額費用' },
      { name: 'Remarks', type: 'Note', title: '備考' },
    ]);

    await this._ensureList(LISTS.DEVICE, '端末マスタ', [
      { name: 'SerialNumber', type: 'Text', title: 'シリアル番号(S/N)' },
      { name: 'DeviceModel', type: 'Text', title: '機種名' },
      { name: 'DeviceType', type: 'Choice', title: '端末種別', choices: ['スマートフォン', 'タブレット', 'ルーター', 'その他'] },
      { name: 'Status', type: 'Choice', title: '状態', choices: ['利用中', '在庫', '故障', '廃棄'] },
      { name: 'PurchaseDate', type: 'DateTime', title: '購入日' },
      { name: 'Remarks', type: 'Note', title: '備考' },
    ]);

    await this._ensureList(LISTS.ALLOCATION, '貸与・割当管理', [
      { name: 'EmployeeId', type: 'Number', title: '従業員参照ID' },
      { name: 'AllocationType', type: 'Choice', title: '割当対象種別', choices: ['SIM+端末セット', '端末のみ', 'SIMのみ', 'Teams外線のみ'] },
      { name: 'SimId', type: 'Number', title: 'SIM参照ID' },
      { name: 'DeviceId', type: 'Number', title: '端末参照ID' },
      { name: 'PhoneNumberId', type: 'Number', title: '電話番号参照ID' },
      { name: 'StartDate', type: 'DateTime', title: '貸与開始日' },
      { name: 'EndDate', type: 'DateTime', title: '貸与終了日' },
      { name: 'IsCurrent', type: 'Boolean', title: '現在利用中' },
      { name: 'Notes', type: 'Note', title: '特記事項' },
    ]);
  }

  private async _ensureList(listName: string, listTitle: string, fields: any[]): Promise<void> {
    const headers = await this._getHeaders();
    // リスト存在確認
    const checkRes = await fetch(
      `${this.siteUrl}/_api/web/lists?$filter=Title eq '${encodeURIComponent(listTitle)}'&$select=Id`,
      { headers: { ...headers, Accept: 'application/json;odata=nometadata' } }
    );
    const checkData = await checkRes.json();

    if (checkData.value && checkData.value.length > 0) {
      // リストが既存の場合、不足フィールドを追加
      const existingFieldsRes = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/fields?$select=InternalName&$filter=Hidden eq false`,
        { headers: { ...headers, Accept: 'application/json;odata=nometadata' } }
      );
      const existingFieldsData = await existingFieldsRes.json();
      const existingNames = new Set((existingFieldsData.value || []).map((f: any) => f.InternalName));
      for (const field of fields) {
        if (!existingNames.has(field.name)) {
          await this._addField(listTitle, field);
        }
      }
      return;
    }

    // リスト作成
    const createRes = await fetch(`${this.siteUrl}/_api/web/lists`, {
      method: 'POST',
      headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' },
      body: JSON.stringify({ Title: listTitle, BaseTemplate: 100, Description: listName }),
    });
    if (!createRes.ok) throw new Error(`リスト作成失敗: ${listTitle}`);

    // フィールド追加
    for (const field of fields) {
      await this._addField(listTitle, field);
    }
  }

  private async _addField(listTitle: string, field: { name: string; type: string; title: string; choices?: string[] }): Promise<void> {
    const headers = await this._getHeaders();
    // SchemaXml形式で英数字の内部名を確実に指定する
    let schemaXml = '';
    if (field.type === 'Choice') {
      const choicesXml = (field.choices || []).map(c => `<CHOICE>${c}</CHOICE>`).join('');
      schemaXml = `<Field Type="Choice" DisplayName="${field.title}" Name="${field.name}" StaticName="${field.name}"><CHOICES>${choicesXml}</CHOICES></Field>`;
    } else if (field.type === 'Note') {
      schemaXml = `<Field Type="Note" DisplayName="${field.title}" Name="${field.name}" StaticName="${field.name}" NumLines="6" RichText="FALSE" />`;
    } else if (field.type === 'DateTime') {
      schemaXml = `<Field Type="DateTime" DisplayName="${field.title}" Name="${field.name}" StaticName="${field.name}" Format="DateOnly" />`;
    } else if (field.type === 'Number') {
      schemaXml = `<Field Type="Number" DisplayName="${field.title}" Name="${field.name}" StaticName="${field.name}" />`;
    } else if (field.type === 'Boolean') {
      schemaXml = `<Field Type="Boolean" DisplayName="${field.title}" Name="${field.name}" StaticName="${field.name}"><Default>0</Default></Field>`;
    } else {
      schemaXml = `<Field Type="Text" DisplayName="${field.title}" Name="${field.name}" StaticName="${field.name}" MaxLength="255" />`;
    }

    const res = await fetch(`${this.siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/fields/createfieldasxml`, {
      method: 'POST',
      headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' },
      body: JSON.stringify({ parameters: { SchemaXml: schemaXml } }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`フィールド追加失敗 (${field.name}): ${errText.substring(0, 100)}`);
    }
  }

  private async _getHeaders(): Promise<Record<string, string>> {
    const digestRes = await fetch(`${this.siteUrl}/_api/contextinfo`, {
      method: 'POST',
      headers: { Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json' },
    });
    const digestData = await digestRes.json();
    const digest = digestData.FormDigestValue;
    return { 'X-RequestDigest': digest };
  }

  // ============================================================
  // CRUD: 従業員マスタ
  // ============================================================
  public async getEmployees(): Promise<IEmployee[]> {
    // 実際のSharePoint内部フィールド名で取得（日本語フィールドはUnicodeエンコード名、英数字フィールドはそのまま）
    const res = await fetch(
      `${this.siteUrl}/_api/web/lists/getbytitle('従業員マスタ（社員台帳）')/items?$select=Id,Title,_x6c0f__x540d_,_x90e8__x7f72_,_x5f79__x8077_,MobileNumber,TeamsPhone,Email,HibinoEmployeeNo,_x5728__x7c4d__x72b6__x6cc1_,_x5165__x793e__x65e5_,_x9000__x793e__x65e5_,_x5099__x8003_&$orderby=_x90e8__x7f72_,_x6c0f__x540d_&$top=5000`,
      { headers: { Accept: 'application/json;odata=nometadata' } }
    );
    const data = await res.json();
    // 内部名をモデルのプロパティ名にマッピング
    return (data.value || []).map((item: any) => ({
      Id: item.Id,
      Title: item.Title || '',
      EmployeeName: item['_x6c0f__x540d_'] || '',
      Department: item['_x90e8__x7f72_'] || '',
      JobTitle: item['_x5f79__x8077_'] || '',
      MobileNumber: item.MobileNumber || '',
      TeamsPhone: item.TeamsPhone || '',
      Email: item.Email || '',
      HibinoEmployeeNo: item.HibinoEmployeeNo || '',
      Status: item['_x5728__x7c4d__x72b6__x6cc1_'] || '',
      JoinDate: item['_x5165__x793e__x65e5_'] ? item['_x5165__x793e__x65e5_'].substring(0, 10) : '',
      LeaveDate: item['_x9000__x793e__x65e5_'] ? item['_x9000__x793e__x65e5_'].substring(0, 10) : '',
      Remarks: item['_x5099__x8003_'] || '',
    }));
  }

  public async saveEmployee(item: IEmployee): Promise<void> {
    const headers = await this._getHeaders();
    // 日本語フィールドはUnicodeエンコード内部名、英数字フィールドはそのまま使用
    const body: any = {
      Title: item.Title || '',
      '_x6c0f__x540d_': item.EmployeeName || '',
      '_x5f79__x8077_': item.JobTitle || '',
      MobileNumber: item.MobileNumber || '',
      TeamsPhone: item.TeamsPhone || '',
      Email: item.Email || '',
      HibinoEmployeeNo: item.HibinoEmployeeNo || '',
      '_x5099__x8003_': item.Remarks || '',
    };
    // Choiceフィールドは値がある場合のみセット（空文字だとエラーになる場合がある）
    if (item.Department) body['_x90e8__x7f72_'] = item.Department;
    body['_x5728__x7c4d__x72b6__x6cc1_'] = item.Status || '在籍';
    if (item.JoinDate) body['_x5165__x793e__x65e5_'] = item.JoinDate.length === 10 ? `${item.JoinDate}T00:00:00Z` : item.JoinDate;
    if (item.LeaveDate) body['_x9000__x793e__x65e5_'] = item.LeaveDate.length === 10 ? `${item.LeaveDate}T00:00:00Z` : item.LeaveDate;
    if (item.Id) {
      const res = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('従業員マスタ（社員台帳）')/items(${item.Id})`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, body: JSON.stringify(body) }
      );
      if (!res.ok && res.status !== 204) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
    } else {
      const res = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('従業員マスタ（社員台帳）')/items`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' }, body: JSON.stringify(body) }
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
    }
  }

  // ============================================================
  // CRUD: 電話番号マスタ
  // ============================================================
  public async getPhoneNumbers(): Promise<IPhoneNumber[]> {
    const res = await fetch(
      `${this.siteUrl}/_api/web/lists/getbytitle('電話番号マスタ')/items?$select=Id,Title,NumberType,Carrier,Status,Remarks&$orderby=NumberType,Title&$top=5000`,
      { headers: { Accept: 'application/json;odata=nometadata' } }
    );
    const data = await res.json();
    return data.value || [];
  }

  public async savePhoneNumber(item: IPhoneNumber): Promise<void> {
    const headers = await this._getHeaders();
    const body = { Title: item.Title, NumberType: item.NumberType, Carrier: item.Carrier, Status: item.Status, Remarks: item.Remarks || '' };
    if (item.Id) {
      await fetch(`${this.siteUrl}/_api/web/lists/getbytitle('電話番号マスタ')/items(${item.Id})`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, body: JSON.stringify(body) });
    } else {
      await fetch(`${this.siteUrl}/_api/web/lists/getbytitle('電話番号マスタ')/items`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' }, body: JSON.stringify(body) });
    }
  }

  // ============================================================
  // CRUD: SIMマスタ
  // ============================================================
  public async getSims(): Promise<ISim[]> {
    const res = await fetch(
      `${this.siteUrl}/_api/web/lists/getbytitle('SIMマスタ')/items?$select=Id,Title,PhoneNumberId,Carrier,PlanName,SimType,Status,MonthlyCost,Remarks&$orderby=Status,Carrier&$top=5000`,
      { headers: { Accept: 'application/json;odata=nometadata' } }
    );
    const data = await res.json();
    return data.value || [];
  }

  public async saveSim(item: ISim): Promise<void> {
    const headers = await this._getHeaders();
    const body = {
      Title: item.Title, PhoneNumberId: item.PhoneNumberId || null, Carrier: item.Carrier,
      PlanName: item.PlanName || '', SimType: item.SimType, Status: item.Status,
      MonthlyCost: item.MonthlyCost || null, Remarks: item.Remarks || '',
    };
    if (item.Id) {
      await fetch(`${this.siteUrl}/_api/web/lists/getbytitle('SIMマスタ')/items(${item.Id})`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, body: JSON.stringify(body) });
    } else {
      await fetch(`${this.siteUrl}/_api/web/lists/getbytitle('SIMマスタ')/items`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' }, body: JSON.stringify(body) });
    }
  }

  // ============================================================
  // CRUD: 端末マスタ
  // ============================================================
  public async getDevices(): Promise<IDevice[]> {
    const res = await fetch(
      `${this.siteUrl}/_api/web/lists/getbytitle('端末マスタ')/items?$select=Id,Title,SerialNumber,DeviceModel,DeviceType,Status,PurchaseDate,Remarks&$orderby=Status,DeviceType&$top=5000`,
      { headers: { Accept: 'application/json;odata=nometadata' } }
    );
    const data = await res.json();
    return data.value || [];
  }

  public async saveDevice(item: IDevice): Promise<void> {
    const headers = await this._getHeaders();
    const body = {
      Title: item.Title, SerialNumber: item.SerialNumber || '', DeviceModel: item.DeviceModel,
      DeviceType: item.DeviceType, Status: item.Status,
      PurchaseDate: item.PurchaseDate ? `${item.PurchaseDate}T00:00:00Z` : null,
      Remarks: item.Remarks || '',
    };
    if (item.Id) {
      await fetch(`${this.siteUrl}/_api/web/lists/getbytitle('端末マスタ')/items(${item.Id})`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, body: JSON.stringify(body) });
    } else {
      await fetch(`${this.siteUrl}/_api/web/lists/getbytitle('端末マスタ')/items`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' }, body: JSON.stringify(body) });
    }
  }

  // ============================================================
  // CRUD: 割当管理
  // ============================================================
  public async getAllocations(currentOnly: boolean = true): Promise<IAllocation[]> {
    const filter = currentOnly ? '&$filter=IsCurrent eq 1' : '';
    const res = await fetch(
      `${this.siteUrl}/_api/web/lists/getbytitle('貸与・割当管理')/items?$select=Id,Title,EmployeeId,AllocationType,SimId,DeviceId,PhoneNumberId,StartDate,EndDate,IsCurrent,Notes${filter}&$orderby=EmployeeId,StartDate desc&$top=5000`,
      { headers: { Accept: 'application/json;odata=nometadata' } }
    );
    const data = await res.json();
    return data.value || [];
  }

  public async saveAllocation(item: IAllocation): Promise<void> {
    const headers = await this._getHeaders();
    const body = {
      Title: item.Title, EmployeeId: item.EmployeeId, AllocationType: item.AllocationType,
      SimId: item.SimId || null, DeviceId: item.DeviceId || null, PhoneNumberId: item.PhoneNumberId || null,
      StartDate: item.StartDate ? `${item.StartDate}T00:00:00Z` : null,
      EndDate: item.EndDate ? `${item.EndDate}T00:00:00Z` : null,
      IsCurrent: item.IsCurrent, Notes: item.Notes || '',
    };
    if (item.Id) {
      await fetch(`${this.siteUrl}/_api/web/lists/getbytitle('貸与・割当管理')/items(${item.Id})`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, body: JSON.stringify(body) });
    } else {
      await fetch(`${this.siteUrl}/_api/web/lists/getbytitle('貸与・割当管理')/items`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' }, body: JSON.stringify(body) });
    }
  }

  // 資産のステータスを更新（割当/返却時）
  public async updateSimStatus(simId: number, status: ISim['Status']): Promise<void> {
    const headers = await this._getHeaders();
    await fetch(`${this.siteUrl}/_api/web/lists/getbytitle('SIMマスタ')/items(${simId})`,
      { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, body: JSON.stringify({ Status: status }) });
  }

  public async updateDeviceStatus(deviceId: number, status: IDevice['Status']): Promise<void> {
    const headers = await this._getHeaders();
    await fetch(`${this.siteUrl}/_api/web/lists/getbytitle('端末マスタ')/items(${deviceId})`,
      { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, body: JSON.stringify({ Status: status }) });
  }

  public async updatePhoneNumberStatus(phoneNumberId: number, status: IPhoneNumber['Status']): Promise<void> {
    const headers = await this._getHeaders();
    await fetch(`${this.siteUrl}/_api/web/lists/getbytitle('電話番号マスタ')/items(${phoneNumberId})`,
      { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, body: JSON.stringify({ Status: status }) });
  }
}
