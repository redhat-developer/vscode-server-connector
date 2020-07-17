import { InputBox, ViewItem, Workbench, TreeItem, VSBrowser } from "vscode-extension-tester";
import { AdaptersConstants } from "../../common/adaptersContants";
import { Server } from "./server";
import { AbstractServer } from "./abstractServer";
import { IServersProvider } from "./IServersProvider";


/**
 * RSP Server Provider item representation
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export class RSPServerProvider extends AbstractServer {

    private _serversProvider: IServersProvider;

    constructor(sbar: IServersProvider, name: string) {
        super(name);
        this._serversProvider = sbar;
    }

    public get serversProvider(): IServersProvider {
        return this._serversProvider;
    }

    async getTreeItem(): Promise<ViewItem> {
        const section = await this.serversProvider.getServerProviderTreeSection();
        VSBrowser.instance.driver.wait( async () => { return (await section.getVisibleItems()).length > 0;}, 3000);
        const rspServerItem = await section.findItem(this.serverName);
        if (!rspServerItem) {
            const availableItems = await Promise.all((await section.getVisibleItems()).map(async (item) => await item.getText()));
            throw Error('No item found for name ' + this.serverName + ', available items: ' + availableItems);
        }
        return rspServerItem;
    }

    async getServers(): Promise<Server[]> {
        let servers = [];
        const items = await (await this.getTreeItem() as TreeItem).getChildren();
        for (let item of items) {
            const label = await item.getLabel();
            servers.push(new Server(label, this));
        }
        return servers;
    }

    async getServer(name: string): Promise<Server> {
        const items = await (await this.getTreeItem() as TreeItem).getChildren();
        for (let item of items) {
            const label = await item.getLabel();
            if (label === name) {
                return new Server(label, this);
            }
        }
        throw Error('Server "' + name + '" does not exist');
    }

    async getCreateNewServerBox(): Promise<InputBox> {
        const item = await this.getTreeItem();
        const menu = await item.openContextMenu();
        await menu.select(AdaptersConstants.RSP_SERVER_PROVIDER_CREATE_NEW_SERVER);
        return await InputBox.create();
    }

    async createNewServerCommand(): Promise<void> {
        const input = await new Workbench().openCommandPrompt() as InputBox;
        await input.setText('>' + AdaptersConstants.RSP_COMMAND + ' ' + AdaptersConstants.RSP_SERVER_PROVIDER_CREATE_NEW_SERVER);
        await input.confirm();
    }

    delete(): Promise<void> {
        throw Error('RSP Server does not support delete operation');
    }

}