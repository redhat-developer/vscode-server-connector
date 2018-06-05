import {
    TreeDataProvider,
    Event,
    TreeItem,
    window,
    OpenDialogOptions,
    InputBoxOptions,
    EventEmitter
} from 'vscode';
import { MessageConnection } from 'vscode-jsonrpc';
import { FindServerBeansRequest, CreateServerRequest, ServerAttributes, GetServerHandlersRequest, ServerHandle, ServerStateChange } from './protocol';

export class ServersViewTreeDataProvider implements TreeDataProvider<ServerHandle> {

    private _onDidChangeTreeData: EventEmitter<ServerHandle | undefined> = new EventEmitter<ServerHandle | undefined>();
    readonly onDidChangeTreeData: Event<ServerHandle | undefined> = this._onDidChangeTreeData.event;
    private connection: MessageConnection;
    private servers: ServerHandle[] = new Array<ServerHandle>();
    private serverStatus: Map<string, number> = new Map<string, number>();
    private serverStatusEnum: Map<number, string> = new Map<number, string>();

    constructor(connection: MessageConnection) {
        this.connection = connection;
        this.serverStatusEnum.set(0, 'Unknown');
        this.serverStatusEnum.set(1, 'Starting');
        this.serverStatusEnum.set(2, 'Started');
        this.serverStatusEnum.set(3, 'Stopping');
        this.serverStatusEnum.set(4, 'Stopped');
    }

    insertServer(handle) {
        this.servers.push(handle);
        this.serverStatus.set(handle.id,4);
        this.refresh();
    }

    updateServer(event:ServerStateChange) {
        this.servers.forEach((value) => {
            if(value.id === event.server.id) {
                this.serverStatus.set(value.id,event.state);
                this.refresh(value);
            }
        });
    }

    removeServer(handle: ServerHandle): any {
        this.servers.forEach((value, index) => {
            if(value.id === handle.id) {
                this.servers.splice(index, 1);
                this.serverStatus.delete(handle.id);
                this.refresh();
            }
        });
    }

    refresh(data?): void {
        this._onDidChangeTreeData.fire(data);
    }

    addLocation(): any {
        window.showOpenDialog(<OpenDialogOptions>{
            canSelectFiles: false,
            canSelectMany: false,
            canSelectFolders: true,
            openLabel: 'Select server location'
        }).then(folders => {
            return this.connection.sendRequest(FindServerBeansRequest.type, { filepath: folders[0].fsPath });
        }).then(serverBeans => {
            if (serverBeans.length > 0) {
                // Prompt for server name
                var options: InputBoxOptions = {
                    prompt: "Server Name", validateInput: (value) => {
                        // search for servers with the same name
                        return null;
                    }
                };
                return window.showInputBox(options).then(value => {
                    return { name: value, bean: serverBeans[0] };
                });
            }
        }).then(data => {
            var serverAttributes: ServerAttributes = {
                id: `${data.bean.specificType}${data.name}`,
                serverType: data.bean.serverAdapterTypeId,
                attributes: {
                    "server.home.dir": data.bean.location
                }
            };
            return this.connection.sendRequest(CreateServerRequest.type, serverAttributes);
        }).then(status => {
            console.log(status);
        });
    }

    getTreeItem(server: ServerHandle): TreeItem | Thenable<TreeItem> {
        var status:number = this.serverStatus.get(server.id);
        return new TreeItem(server.id + '(' + this.serverStatusEnum.get(status) + ')');
    }

    getChildren(element?: ServerHandle | undefined): ServerHandle[] | Thenable<ServerHandle[] | null | undefined> | null | undefined {
        if (element === undefined) {
            return this.servers;
        }
    }

    sreverChanged(serverChangeEvent): void {
       this.refresh();
    }
}