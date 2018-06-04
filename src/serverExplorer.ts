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
import { FindServerBeansRequest, CreateServerRequest, ServerAttributes, GetServerHandlersRequest, ServerHandle } from './protocol';

export class ServersViewTreeDataProvider implements TreeDataProvider<ServerHandle> {
    private _onDidChangeTreeData: EventEmitter<ServerHandle | undefined> = new EventEmitter<ServerHandle | undefined>();
    readonly onDidChangeTreeData: Event<ServerHandle | undefined> = this._onDidChangeTreeData.event;
    private connection: MessageConnection;
    private servers: Thenable<ServerHandle[]>;
    private serverStatus: Map<string, number> = new Map<string, number>();

    constructor(connection: MessageConnection) {
        this.connection = connection;
        this.servers = this.connection.sendRequest(GetServerHandlersRequest.type);
        this.servers.then((s:ServerHandle[]) => {
            s.forEach((value) => {
                this.serverStatus.set(value.id,4);
            });
        });

    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
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

    getTreeItem(label: ServerHandle): TreeItem | Thenable<TreeItem> {
        var status:number = this.serverStatus.get(label.id);
        return new TreeItem(label.id + '(' + status + ')');
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