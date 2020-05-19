import { InputBox, ViewItem, VSBrowser, Workbench, By } from "vscode-extension-tester";
import { AdaptersConstants } from "../../common/adaptersContants";
import { ServerState } from "../../common/serverState";
import { serverHasState, asyncFilter } from "../serverUtils";
import { ServersActivityBar } from "./serversActivityBar";


/**
 * RSP Server Provider item representation
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export class RSPServerProvider {

    private _serverProviderName: string;
    private _serversActivityBar: ServersActivityBar;

    constructor(sbar: ServersActivityBar, name: string) {
        this._serverProviderName = name;
        this._serversActivityBar = sbar;
    }

    public get serverProviderName(): string {
        return this._serverProviderName;
    }

    public get serversActivityBar(): ServersActivityBar {
        return this._serversActivityBar;
    }

    async getTreeItem(): Promise<ViewItem> {
        const section = await this.serversActivityBar.getServerProviderTreeSection();
        const items = await section.getVisibleItems();
        const filteredItems = await asyncFilter(items, async (item) => {
            return (await item.getText()).indexOf(this.serverProviderName) >= 0;
        })
        if (filteredItems.length > 1) {
            var servers;
            for (let item of filteredItems) {
                servers += await item.getText() + ' ';
            }
            throw Error("Unambiguous items found for rsp server provider, should be only one, but found: " + servers); 
        } else if (filteredItems.length == 0) {
            throw Error('No item found for name ' + this.serverProviderName)
        }
        return filteredItems[0];
    }

    async performServerOperation(contextMenuItem: string, expectedState: ServerState, timeout: number) {
        await (await this.getTreeItem()).select();
        const menu = await (await this.getTreeItem()).openContextMenu();
        await menu.select(contextMenuItem);
        await VSBrowser.instance.driver.wait(() => { return serverHasState(this, expectedState);}, timeout );
    }

    async startServerProvider(timeout: number=7000) {
        await this.performServerOperation(AdaptersConstants.RSP_SERVER_PROVIDER_START, ServerState.Started, timeout);
    }

    async stopServerProvider(timeout: number = 7000) {
        await this.performServerOperation(AdaptersConstants.RSP_SERVER_PROVIDER_STOP, ServerState.Stopped, timeout);
    }

    async terminateServerProvider(timeout: number = 7000) {
        await this.performServerOperation(AdaptersConstants.RSP_SERVER_PROVIDER_TERMINATE, ServerState.Stopped, timeout);
    }

    async getCreateNewServerBox(): Promise<InputBox> {
        await (await (await this.getTreeItem()).openContextMenu()).select(AdaptersConstants.RSP_SERVER_PROVIDER_CREATE_NEW_SERVER);
        return await InputBox.create();
    }

    async createNewServerCommand(): Promise<void> {
        const input = await new Workbench().openCommandPrompt() as InputBox;
        await input.setText('>' + AdaptersConstants.RSP_COMMAND + ' ' + AdaptersConstants.RSP_SERVER_PROVIDER_CREATE_NEW_SERVER);
        await input.confirm();
    }

    async getServerName(): Promise<string> {
        const item = await this.getTreeItem();
        return await item.getText();
    }

    async getServerStateLabel(): Promise<string> {
        const text = await (await this.getTreeItem()).findElement(By.className('label-description')).getText();
        return text.slice(text.indexOf('(') + 1, text.indexOf(')'));
    }

    async getServerState(): Promise<ServerState> {
        var label = (await this.getServerStateLabel());
        return ServerState[label];
    }
}