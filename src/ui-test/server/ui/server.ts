import { RSPServerProvider } from "./rspServerProvider";
import { ViewItem, TreeItem } from "vscode-extension-tester";
import { AbstractServer } from "./abstractServer";
import { AdaptersConstants } from "../../common/adaptersContants";
import { ServerState } from "../../common/enum/serverState";

/**
 * RSP Server Provider item representation
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export class Server extends AbstractServer {

    private _serverParent: RSPServerProvider;

    constructor(name: string, parent: RSPServerProvider) {
        super(name);
        this._serverParent = parent;
    }

    public get serverParent(): RSPServerProvider {
        return this._serverParent;
    }
    public set serverParent(value: RSPServerProvider) {
        this._serverParent = value;
    }

    protected async getTreeItem(): Promise<ViewItem> {
        const parent = await this.serverParent.getTreeItem();
        const treeItem = await (parent as TreeItem).findChildItem(this.serverName);
        return treeItem;
    }

    public async start(timeout: number = 20000): Promise<void> {
        await this.performServerOperation(AdaptersConstants.SERVER_START, ServerState.Started, timeout);
    }

    public async stop(timeout: number = 20000): Promise<void> {
        await this.performServerOperation(AdaptersConstants.SERVER_STOP, ServerState.Stopped, timeout);
    }

    public async terminate(timeout: number = 10000): Promise<void> {
        await this.performServerOperation(AdaptersConstants.SERVER_TERMINATE, ServerState.Stopped, timeout);
    }

    public async restart(timeout: number = 30000): Promise<void> {
        await super.performServerOperation(AdaptersConstants.SERVER_RESTART_RUN, ServerState.Started, timeout);
    }
}