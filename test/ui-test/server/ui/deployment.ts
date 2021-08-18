import { By, TreeItem, ViewItem } from 'vscode-extension-tester';
import { AdaptersConstants } from '../../common/constants/adaptersContants';
import { PublishState } from '../../common/enum/publishState';
import { ServerState } from '../../common/enum/serverState';
import { selectContextMenuItemOnTreeItem } from '../../common/util/testUtils';
import { Server } from './server';

/**
 * Deployment item representation
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export class Deployment {

    private _serverParent: Server;
    private _name: string;

    constructor(name: string, parent: Server) {
        this._name = name;
        this._serverParent = parent;
    }

    public get serverParent(): Server {
        return this._serverParent;
    }
    public set serverParent(value: Server) {
        this._serverParent = value;
    }

    public get name(): string {
        return this._name;
    }
    public set name(value: string) {
        this._name = value;
    }

    public async getTreeItem(): Promise<ViewItem> {
        const parentItem = await this.serverParent.getTreeItem();
        const item = await (parentItem as TreeItem).findChildItem(this.name);
        return item;
    }

    private async getDeploymentLabelDescription(): Promise<string> {
        const treeItem = await this.getTreeItem();
        const element = await treeItem.findElement(By.className('label-description'));
        // https://stackoverflow.com/questions/23804123/selenium-gettext
        // const text = await element.getText();
        return await element.getAttribute('innerHTML');
    }

    public async getDeploymentStateLabel(): Promise<string> {
        const description = await this.getDeploymentLabelDescription();
        return description.slice(description.indexOf('(') + 1, description.indexOf(')'));
    }

    public async getDeploymentPublishStateLabel(): Promise<string> {
        const description = await this.getDeploymentLabelDescription();
        const firstEndBrace = description.indexOf(')');
        const startSearchForSecond = description.indexOf('(', firstEndBrace + 1);
        return description.slice(startSearchForSecond + 1, description.length - 1);
    }

    public async getDeploymentState(): Promise<ServerState> {
        const stateLabel = await this.getDeploymentStateLabel();
        return ServerState[stateLabel];
    }

    public async getDeploymentPublishState(): Promise<PublishState> {
        const stateLabel = await this.getDeploymentPublishStateLabel();
        const result = Object.keys(PublishState).filter(key => stateLabel === PublishState[key]);
        return PublishState[result[0]];
    }

    public async removeDeployment(): Promise<void> {
        await this.selectContextMenuItem(AdaptersConstants.DEPLOYMENT_REMOVE);
    }

    public async selectContextMenuItem(item: string): Promise<void> {
        const treeItem = await this.getTreeItem() as TreeItem;
        await treeItem.select();
        if (!(await treeItem.isSelected())) {
            await treeItem.select();
        }
        await selectContextMenuItemOnTreeItem(treeItem, item);
    }
}
