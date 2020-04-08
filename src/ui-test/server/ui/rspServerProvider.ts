import { InputBox, ViewItem, VSBrowser, Workbench } from "vscode-extension-tester";
import { AdaptersConstants } from "../../common/adaptersContants";
import { ServerState } from "../../common/serverState";
import { serverHasState } from "../serverUtils";


/**
 * RSP Server Provider item representation
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export class RSPServerProvider {

    private _serverProviderItem: ViewItem;

    constructor(item: ViewItem) {
        this._serverProviderItem = item;
    }

    public get serverProviderItem(): ViewItem {
        if (this._serverProviderItem && this._serverProviderItem.isDisplayed()) {
            return this._serverProviderItem;
        } else {
            throw Error('Server provider item (ViewItem object) is disposed or unavailable');
        }
    }

    async performServerOperation(contextMenuItem: string, expectedState: ServerState, timeout: number) {
        await this.serverProviderItem.select();
        const menu = await this.serverProviderItem.openContextMenu();
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
        await (await this.serverProviderItem.openContextMenu()).select(AdaptersConstants.RSP_SERVER_PROVIDER_CREATE_NEW_SERVER);
        return await InputBox.create();
    }

    async createNewServerCommand(): Promise<void> {
        const input = await new Workbench().openCommandPrompt() as InputBox;
        await input.setText('>' + AdaptersConstants.RSP_COMMAND + ' ' + AdaptersConstants.RSP_SERVER_PROVIDER_CREATE_NEW_SERVER);
        await input.confirm();
    }

    async getNameLabel(): Promise<string> {
        return this.serverProviderItem.getText();
    }

    async getServerName(): Promise<string> {
        const text = await this.serverProviderItem.getText();
        return text.slice(0, text.indexOf('(') - 1); 
    }

    async getServerStateLabel(): Promise<string> {
        const text = await this.serverProviderItem.getText();
        return text.slice(text.indexOf('(') + 1, text.indexOf(')'));
    }

    async getServerState(): Promise<ServerState> {
        var label = (await this.getServerStateLabel());
        return ServerState[label];
    }
}