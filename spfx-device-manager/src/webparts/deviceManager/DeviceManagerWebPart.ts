import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField,
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { DeviceManager, IDeviceManagerProps } from './components/DeviceManager';

export interface IDeviceManagerWebPartProps {
  adminUsers: string;
}

export default class DeviceManagerWebPart extends BaseClientSideWebPart<IDeviceManagerWebPartProps> {

  public render(): void {
    const element: React.ReactElement<IDeviceManagerProps> = React.createElement(
      DeviceManager,
      {
        context: this.context,
        adminUsers: this.properties.adminUsers || '',
      }
    );
    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: '通信機器・社員台帳 管理システム 設定' },
          groups: [
            {
              groupName: '管理者設定',
              groupFields: [
                PropertyPaneTextField('adminUsers', {
                  label: '管理者ユーザー (カンマ区切りでメールアドレスを入力)',
                  description: '空欄の場合は全員が管理者権限を持ちます',
                  multiline: false,
                  placeholder: 'admin@company.com, it@company.com',
                }),
              ],
            },
          ],
        },
      ],
    };
  }
}
