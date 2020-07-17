import { ViewItem, By, VSBrowser, TreeItem } from "vscode-extension-tester";
import { DialogHandler } from "vscode-extension-tester-native";
import { IServer } from "./IServer";
import { ServerState } from "../../common/enum/serverState";
import { serverHasState } from "../../common/util/serverUtils";
import { AdaptersConstants } from "../../common/adaptersContants";

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export abstract class AbstractServer implements IServer {

    private _serverName: string;

    constructor(name: string) {
        this._serverName = name;
    }

    public get serverName(): string {
        return this._serverName;
    }
    public set serverName(value: string) {
        this._serverName = value;
    }

    async getServerStateLabel(): Promise<string> {
        const text = await (await (await this.getTreeItem()).findElement(By.className('label-description'))).getText();
        return text.slice(text.indexOf('(') + 1, text.indexOf(')'));
    }

    async getServerState(): Promise<ServerState> {
        var label = (await this.getServerStateLabel());
        return ServerState[label];
    }
    
    async getServerName(): Promise<string> {
        const item = (await this.getTreeItem()) as TreeItem;
        if (!item) {
            throw Error('TreeItem of the object in undefined');
        }
        return item.getLabel();
    }

    async performServerOperation(contextMenuItem: string, expectedState: ServerState, timeout: number): Promise<void> {
        await (await this.getTreeItem()).select();
        const treeItem = await this.getTreeItem();
        await treeItem.select();
        const menu = await treeItem.openContextMenu();
        await menu.select(contextMenuItem);
        await VSBrowser.instance.driver.wait( async () => { return await serverHasState(this, expectedState);}, timeout );
    }

    async start(timeout: number=10000): Promise<void> {
        await this.performServerOperation(AdaptersConstants.RSP_SERVER_PROVIDER_START, ServerState.Started, timeout);
    }

    async stop(timeout: number = 10000): Promise<void> {
        await this.performServerOperation(AdaptersConstants.RSP_SERVER_PROVIDER_STOP, ServerState.Stopped, timeout);
    }

    async terminate(timeout: number = 7000): Promise<void> {
        await this.performServerOperation(AdaptersConstants.RSP_SERVER_PROVIDER_TERMINATE, ServerState.Stopped, timeout);
    }

    async delete(): Promise<void> {
        const serverItem = await this.getTreeItem();
        const menu = await serverItem.openContextMenu();
        if (await menu.hasItem(AdaptersConstants.SERVER_REMOVE)) {
            await (await menu.getItem(AdaptersConstants.SERVER_REMOVE)).click();
            const dialog = await DialogHandler.getOpenDialog();
            await dialog.confirm();
        } else {
            throw Error('Given server ' + this.getServerName() + 'does not allow to remove the server in actual state, could be started');
        }
    }

    abstract getTreeItem(): Promise<ViewItem>;
}