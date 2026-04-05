import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IEmployee, ISim, IDevice, IAllocation } from '../models/IModels';

// ============================================================
// SharePoint REST API サービス
// フィールド作成: 英語DisplayNameで作成 → 日本語DisplayNameに更新（内部名を英数字で確実に生成）
// ============================================================

const LISTS = {
  EMPLOYEE: 'EmployeeMaster',
  SIM: 'SIMMaster',
  DEVICE: 'DeviceMaster',
  ALLOCATION: 'AssetAllocation',
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
      { name: 'EmployeeName', type: 'Text', englishTitle: 'EmployeeName', title: '氏名' },
      { name: 'Department', type: 'Choice', englishTitle: 'Department', title: '部署', choices: ['代表取締役社長', '取締役', '管理部', '開発部', 'BSI事業部', 'VS事業部', 'その他'] },
      { name: 'JobTitle', type: 'Text', englishTitle: 'JobTitle', title: '役職' },
      { name: 'MobileNumber', type: 'Text', englishTitle: 'MobileNumber', title: '携帯番号' },
      { name: 'TeamsPhone', type: 'Text', englishTitle: 'TeamsPhone', title: 'Teams外線番号' },
      { name: 'Email', type: 'Text', englishTitle: 'Email', title: 'メールアドレス' },
      { name: 'HibinoEmployeeNo', type: 'Text', englishTitle: 'HibinoEmployeeNo', title: 'HIBINO社員番号' },
      { name: 'Status', type: 'Choice', englishTitle: 'Status', title: '在籍状況', choices: ['在籍', '休職', '退職'] },
      { name: 'JoinDate', type: 'DateTime', englishTitle: 'JoinDate', title: '入社日' },
      { name: 'LeaveDate', type: 'DateTime', englishTitle: 'LeaveDate', title: '退社日' },
      { name: 'Remarks', type: 'Note', englishTitle: 'Remarks', title: '備考' },
    ]);

    await this._ensureList(LISTS.SIM, 'SIMマスタ', [
      { name: 'ICCID', type: 'Text', englishTitle: 'ICCID', title: 'ICCID' },
      { name: 'PhoneNo', type: 'Text', englishTitle: 'PhoneNo', title: '電話番号' },
      { name: 'Carrier', type: 'Choice', englishTitle: 'Carrier', title: '通信キャリア', choices: ['KDDI', 'HISモバイル', 'docomo', 'SoftBank', 'その他'] },
      { name: 'SimType', type: 'Choice', englishTitle: 'SimType', title: 'SIM種別', choices: ['音声SIM', 'SMS付きデータSIM', 'データSIM'] },
      { name: 'PlanName', type: 'Text', englishTitle: 'PlanName', title: '契約プラン名' },
      { name: 'MonthlyCost', type: 'Number', englishTitle: 'MonthlyCost', title: '月額費用' },
      { name: 'ContractDate', type: 'DateTime', englishTitle: 'ContractDate', title: '契約開始日' },
      { name: 'Status', type: 'Choice', englishTitle: 'Status', title: '状態', choices: ['利用中', '在庫(未割当)', '解約済', '紛失'] },
      { name: 'Remarks', type: 'Note', englishTitle: 'Remarks', title: '備考' },
    ]);

    await this._ensureList(LISTS.DEVICE, '端末マスタ', [
      { name: 'SerialNumber', type: 'Text', englishTitle: 'SerialNumber', title: 'シリアル番号(S/N)' },
      { name: 'DeviceModel', type: 'Text', englishTitle: 'DeviceModel', title: '機種名' },
      { name: 'DeviceType', type: 'Choice', englishTitle: 'DeviceType', title: '端末種別', choices: ['スマートフォン', 'タブレット', 'ルーター', 'その他'] },
      { name: 'Status', type: 'Choice', englishTitle: 'Status', title: '状態', choices: ['利用中', '在庫', '故障', '廃棄'] },
      { name: 'PurchaseDate', type: 'DateTime', englishTitle: 'PurchaseDate', title: '購入日' },
      { name: 'Remarks', type: 'Note', englishTitle: 'Remarks', title: '備考' },
    ]);

    await this._ensureList(LISTS.ALLOCATION, '貸与・割当管理', [
      { name: 'EmployeeId', type: 'Number', englishTitle: 'EmployeeId', title: '従業員参照ID' },
      { name: 'AllocationType', type: 'Choice', englishTitle: 'AllocationType', title: '割当対象種別', choices: ['SIM+端末セット', '端末のみ', 'SIMのみ'] },
      { name: 'SimId', type: 'Number', englishTitle: 'SimId', title: 'SIM参照ID' },
      { name: 'DeviceId', type: 'Number', englishTitle: 'DeviceId', title: '端末参照ID' },
      { name: 'StartDate', type: 'DateTime', englishTitle: 'StartDate', title: '貸与開始日' },
      { name: 'EndDate', type: 'DateTime', englishTitle: 'EndDate', title: '貸与終了日' },
      { name: 'IsCurrent', type: 'Boolean', englishTitle: 'IsCurrent', title: '現在利用中' },
      { name: 'Notes', type: 'Note', englishTitle: 'Notes', title: '特記事項' },
    ]);
  }

  private async _ensureList(listName: string, listTitle: string, fields: any[]): Promise<void> {
    const headers = await this._getHeaders();
    const checkRes = await fetch(
      `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')?$select=Id`,
      { headers: { ...headers, Accept: 'application/json;odata=nometadata' } }
    );

    if (checkRes.ok) {
      const existingFieldsRes = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/fields?$select=InternalName&$filter=Hidden eq false`,
        { headers: { ...headers, Accept: 'application/json;odata=nometadata' } }
      );
      const existingFieldsData = await existingFieldsRes.json();
      const existingNames = new Set((existingFieldsData.value || []).map((f: any) => f.InternalName));
      for (const field of fields) {
        if (!existingNames.has(field.name)) {
          await this._addField(listName, field);
        }
      }
      return;
    }

    const createRes = await fetch(`${this.siteUrl}/_api/web/lists`, {
      method: 'POST',
      headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' },
      body: JSON.stringify({ Title: listName, BaseTemplate: 100, Description: listTitle }),
    });
    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`リスト作成失敗 (${listName}): ${errText.substring(0, 200)}`);
    }

    for (const field of fields) {
      await this._addField(listName, field);
    }
  }

  private async _addField(listName: string, field: { name: string; type: string; englishTitle: string; title: string; choices?: string[] }): Promise<void> {
    const headers = await this._getHeaders();
    let schemaXml = '';
    if (field.type === 'Choice') {
      const choicesXml = (field.choices || []).map(c => `<CHOICE>${c}</CHOICE>`).join('');
      schemaXml = `<Field Type="Choice" DisplayName="${field.englishTitle}" Name="${field.name}" StaticName="${field.name}"><CHOICES>${choicesXml}</CHOICES></Field>`;
    } else if (field.type === 'Note') {
      schemaXml = `<Field Type="Note" DisplayName="${field.englishTitle}" Name="${field.name}" StaticName="${field.name}" NumLines="6" RichText="FALSE" />`;
    } else if (field.type === 'DateTime') {
      schemaXml = `<Field Type="DateTime" DisplayName="${field.englishTitle}" Name="${field.name}" StaticName="${field.name}" Format="DateOnly" />`;
    } else if (field.type === 'Number') {
      schemaXml = `<Field Type="Number" DisplayName="${field.englishTitle}" Name="${field.name}" StaticName="${field.name}" />`;
    } else if (field.type === 'Boolean') {
      schemaXml = `<Field Type="Boolean" DisplayName="${field.englishTitle}" Name="${field.name}" StaticName="${field.name}"><Default>0</Default></Field>`;
    } else {
      schemaXml = `<Field Type="Text" DisplayName="${field.englishTitle}" Name="${field.name}" StaticName="${field.name}" MaxLength="255" />`;
    }

    const res = await fetch(`${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/fields/createfieldasxml`, {
      method: 'POST',
      headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' },
      body: JSON.stringify({ parameters: { SchemaXml: schemaXml } }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`フィールド追加失敗 (${field.name}): ${errText.substring(0, 200)}`);
      return;
    }

    // 作成後にDisplayNameを日本語に更新
    if (field.title !== field.englishTitle) {
      const updateHeaders = await this._getHeaders();
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/fields/getbyinternalnameortitle('${field.name}')`,
        {
          method: 'POST',
          headers: { ...updateHeaders, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' },
          body: JSON.stringify({ Title: field.title }),
        }
      );
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
    const res = await fetch(
      `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.EMPLOYEE}')/items?$select=Id,Title,EmployeeName,Department,JobTitle,MobileNumber,TeamsPhone,Email,HibinoEmployeeNo,Status,JoinDate,LeaveDate,Remarks&$orderby=Department,EmployeeName&$top=5000`,
      { headers: { Accept: 'application/json;odata=nometadata' } }
    );
    const data = await res.json();
    return (data.value || []).map((item: any) => ({
      Id: item.Id,
      Title: item.Title || '',
      EmployeeName: item.EmployeeName || '',
      Department: item.Department || '',
      JobTitle: item.JobTitle || '',
      MobileNumber: item.MobileNumber || '',
      TeamsPhone: item.TeamsPhone || '',
      Email: item.Email || '',
      HibinoEmployeeNo: item.HibinoEmployeeNo || '',
      Status: item.Status || '在籍',
      JoinDate: item.JoinDate ? item.JoinDate.substring(0, 10) : '',
      LeaveDate: item.LeaveDate ? item.LeaveDate.substring(0, 10) : '',
      Remarks: item.Remarks || '',
    }));
  }

  public async saveEmployee(item: IEmployee): Promise<void> {
    const headers = await this._getHeaders();
    const body: any = {
      Title: item.Title || '',
      EmployeeName: item.EmployeeName || '',
      JobTitle: item.JobTitle || '',
      MobileNumber: item.MobileNumber || '',
      TeamsPhone: item.TeamsPhone || '',
      Email: item.Email || '',
      HibinoEmployeeNo: item.HibinoEmployeeNo || '',
      Remarks: item.Remarks || '',
      Status: item.Status || '在籍',
    };
    if (item.Department) body.Department = item.Department;
    if (item.JoinDate) body.JoinDate = item.JoinDate.length === 10 ? `${item.JoinDate}T00:00:00Z` : item.JoinDate;
    if (item.LeaveDate) body.LeaveDate = item.LeaveDate.length === 10 ? `${item.LeaveDate}T00:00:00Z` : item.LeaveDate;

    if (item.Id) {
      const res = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.EMPLOYEE}')/items(${item.Id})`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, body: JSON.stringify(body) }
      );
      if (!res.ok && res.status !== 204) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 300)}`);
      }
    } else {
      const res = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.EMPLOYEE}')/items`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' }, body: JSON.stringify(body) }
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 300)}`);
      }
    }
  }

  public async deleteEmployee(id: number): Promise<void> {
    const headers = await this._getHeaders();
    await fetch(
      `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.EMPLOYEE}')/items(${id})`,
      { method: 'POST', headers: { ...headers, 'X-HTTP-Method': 'DELETE', 'IF-MATCH': '*' } }
    );
  }

  // ============================================================
  // CRUD: SIMマスタ
  // ============================================================
  public async getSims(): Promise<ISim[]> {
    const res = await fetch(
      `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.SIM}')/items?$select=Id,Title,ICCID,PhoneNo,Carrier,SimType,PlanName,MonthlyCost,ContractDate,Status,Remarks&$top=5000`,
      { headers: { Accept: 'application/json;odata=nometadata' } }
    );
    const data = await res.json();
    return (data.value || []).map((item: any) => ({
      Id: item.Id,
      Title: item.Title || '',
      ICCID: item.ICCID || '',
      PhoneNo: item.PhoneNo || '',
      Carrier: item.Carrier || '',
      SimType: item.SimType || '',
      PlanName: item.PlanName || '',
      MonthlyCost: item.MonthlyCost || 0,
      ContractDate: item.ContractDate ? item.ContractDate.substring(0, 10) : '',
      Status: item.Status || '在庫(未割当)',
      Remarks: item.Remarks || '',
    }));
  }

  public async saveSim(item: ISim): Promise<void> {
    const headers = await this._getHeaders();
    const body: any = {
      Title: item.Title || '',
      ICCID: item.ICCID || '',
      PhoneNo: item.PhoneNo || '',
      PlanName: item.PlanName || '',
      MonthlyCost: item.MonthlyCost || null,
      Remarks: item.Remarks || '',
    };
    if (item.Carrier) body.Carrier = item.Carrier;
    if (item.SimType) body.SimType = item.SimType;
    if (item.Status) body.Status = item.Status; else body.Status = '在庫(未割当)';
    if (item.ContractDate) body.ContractDate = item.ContractDate.length === 10 ? `${item.ContractDate}T00:00:00Z` : item.ContractDate;

    if (item.Id) {
      const res = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.SIM}')/items(${item.Id})`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, body: JSON.stringify(body) }
      );
      if (!res.ok && res.status !== 204) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 300)}`);
      }
    } else {
      const res = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.SIM}')/items`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' }, body: JSON.stringify(body) }
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 300)}`);
      }
    }
  }

  public async deleteSim(id: number): Promise<void> {
    const headers = await this._getHeaders();
    await fetch(
      `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.SIM}')/items(${id})`,
      { method: 'POST', headers: { ...headers, 'X-HTTP-Method': 'DELETE', 'IF-MATCH': '*' } }
    );
  }

  // ============================================================
  // CRUD: 端末マスタ
  // ============================================================
  public async getDevices(): Promise<IDevice[]> {
    const res = await fetch(
      `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.DEVICE}')/items?$select=Id,Title,SerialNumber,DeviceModel,DeviceType,Status,PurchaseDate,Remarks&$top=5000`,
      { headers: { Accept: 'application/json;odata=nometadata' } }
    );
    const data = await res.json();
    return (data.value || []).map((item: any) => ({
      Id: item.Id,
      Title: item.Title || '',
      SerialNumber: item.SerialNumber || '',
      DeviceModel: item.DeviceModel || '',
      DeviceType: item.DeviceType || '',
      Status: item.Status || '在庫',
      PurchaseDate: item.PurchaseDate ? item.PurchaseDate.substring(0, 10) : '',
      Remarks: item.Remarks || '',
    }));
  }

  public async saveDevice(item: IDevice): Promise<void> {
    const headers = await this._getHeaders();
    const body: any = {
      Title: item.Title || '',
      SerialNumber: item.SerialNumber || '',
      DeviceModel: item.DeviceModel || '',
      Remarks: item.Remarks || '',
    };
    if (item.DeviceType) body.DeviceType = item.DeviceType;
    if (item.Status) body.Status = item.Status; else body.Status = '在庫';
    if (item.PurchaseDate) body.PurchaseDate = item.PurchaseDate.length === 10 ? `${item.PurchaseDate}T00:00:00Z` : item.PurchaseDate;

    if (item.Id) {
      const res = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.DEVICE}')/items(${item.Id})`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, body: JSON.stringify(body) }
      );
      if (!res.ok && res.status !== 204) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 300)}`);
      }
    } else {
      const res = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.DEVICE}')/items`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' }, body: JSON.stringify(body) }
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 300)}`);
      }
    }
  }

  public async deleteDevice(id: number): Promise<void> {
    const headers = await this._getHeaders();
    await fetch(
      `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.DEVICE}')/items(${id})`,
      { method: 'POST', headers: { ...headers, 'X-HTTP-Method': 'DELETE', 'IF-MATCH': '*' } }
    );
  }

  // ============================================================
  // CRUD: 貸与・割当管理
  // ============================================================
  public async getAllocations(currentOnly?: boolean): Promise<IAllocation[]> {
    const filter = currentOnly ? '&$filter=IsCurrent eq 1' : '';
    const res = await fetch(
      `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.ALLOCATION}')/items?$select=Id,Title,EmployeeId,AllocationType,SimId,DeviceId,StartDate,EndDate,IsCurrent,Notes&$top=5000${filter}`,
      { headers: { Accept: 'application/json;odata=nometadata' } }
    );
    const data = await res.json();
    return (data.value || []).map((item: any) => ({
      Id: item.Id,
      Title: item.Title || '',
      EmployeeId: item.EmployeeId || 0,
      AllocationType: item.AllocationType || 'SIM+端末セット',
      SimId: item.SimId || 0,
      DeviceId: item.DeviceId || 0,
      StartDate: item.StartDate ? item.StartDate.substring(0, 10) : '',
      EndDate: item.EndDate ? item.EndDate.substring(0, 10) : '',
      IsCurrent: item.IsCurrent || false,
      Notes: item.Notes || '',
    }));
  }

  public async saveAllocation(item: IAllocation): Promise<void> {
    const headers = await this._getHeaders();
    const body: any = {
      Title: item.Title || '',
      EmployeeId: item.EmployeeId || null,
      SimId: item.SimId || null,
      DeviceId: item.DeviceId || null,
      IsCurrent: item.IsCurrent !== undefined ? item.IsCurrent : true,
      Notes: item.Notes || '',
    };
    if (item.AllocationType) body.AllocationType = item.AllocationType;
    if (item.StartDate) body.StartDate = item.StartDate.length === 10 ? `${item.StartDate}T00:00:00Z` : item.StartDate;
    if (item.EndDate) body.EndDate = item.EndDate.length === 10 ? `${item.EndDate}T00:00:00Z` : item.EndDate;

    if (item.Id) {
      const res = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.ALLOCATION}')/items(${item.Id})`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, body: JSON.stringify(body) }
      );
      if (!res.ok && res.status !== 204) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 300)}`);
      }
    } else {
      const res = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.ALLOCATION}')/items`,
        { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' }, body: JSON.stringify(body) }
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 300)}`);
      }
    }
  }

  // ============================================================
  // ステータス更新メソッド
  // ============================================================
  public async updateSimStatus(simId: number, status: string): Promise<void> {
    const headers = await this._getHeaders();
    await fetch(
      `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.SIM}')/items(${simId})`,
      { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, body: JSON.stringify({ Status: status }) }
    );
  }

  public async updateDeviceStatus(deviceId: number, status: string): Promise<void> {
    const headers = await this._getHeaders();
    await fetch(
      `${this.siteUrl}/_api/web/lists/getbytitle('${LISTS.DEVICE}')/items(${deviceId})`,
      { method: 'POST', headers: { ...headers, Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, body: JSON.stringify({ Status: status }) }
    );
  }
}
