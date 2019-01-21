import {
    TreeDataProvider,
    Event,
    TreeItem,
    window,
    OpenDialogOptions,
    InputBoxOptions,
    EventEmitter,
    OutputChannel,
    workspace,
    Uri
} from 'vscode';
import * as path from 'path';

import {
    RSPClient,
    Protocol,
    ServerState
} from 'rsp-client';

export class ServersViewTreeDataProvider implements TreeDataProvider<Protocol.ServerHandle> {

    private _onDidChangeTreeData: EventEmitter<Protocol.ServerHandle | undefined> = new EventEmitter<Protocol.ServerHandle | undefined>();
    readonly onDidChangeTreeData: Event<Protocol.ServerHandle | undefined> = this._onDidChangeTreeData.event;
    private client: RSPClient;
    public servers: Map<string, Protocol.ServerHandle> = new Map<string, Protocol.ServerHandle>();
    public serverStatus: Map<string, number> = new Map<string, number>();
    public serverOutputChannels: Map<string, OutputChannel> = new Map<string, OutputChannel>();
    public serverStatusEnum: Map<number, string> = new Map<number, string>();

    constructor(client: RSPClient) {
        this.client = client;
        this.serverStatusEnum.set(0, 'Unknown');
        this.serverStatusEnum.set(1, 'Starting');
        this.serverStatusEnum.set(2, 'Started');
        this.serverStatusEnum.set(3, 'Stopping');
        this.serverStatusEnum.set(4, 'Stopped');
        client.getServerHandles().then(servers => servers.forEach(server => this.insertServer(server)));
    }

    insertServer(handle): void {
        this.servers.set(handle.id, handle);
        this.serverStatus.set(handle.id, ServerState.STOPPED);
        this.refresh();
    }

    updateServer(event: Protocol.ServerStateChange): void {
        const value = this.servers.get(event.server.id);
        this.serverStatus.set(value.id, event.state);
        this.refresh(value);
        const channel: OutputChannel = this.serverOutputChannels.get(value.id);
        if (event.state === ServerState.STARTING && channel) {
            channel.clear();
        }
    }

    removeServer(handle: Protocol.ServerHandle): void {
        this.servers.delete(handle.id);
        this.serverStatus.delete(handle.id);
        this.refresh();
        const channel: OutputChannel = this.serverOutputChannels.get(handle.id);
        this.serverOutputChannels.delete(handle.id);
        if (channel) {
            channel.clear();
            channel.dispose();
        }
    }

    addServerOutput(output: Protocol.ServerProcessOutput): void {
        let channel: OutputChannel = this.serverOutputChannels.get(output.server.id);
        if (channel === undefined) {
            channel = window.createOutputChannel(`Server: ${output.server.id}`);
            this.serverOutputChannels.set(output.server.id, channel);
        }
        channel.append(output.text);
        if (workspace.getConfiguration('vscodeAdapters').get<boolean>('showChannelOnServerOutput')) {
            channel.show();
        }
    }

    showOutput(server: Protocol.ServerHandle): void {
        const channel: OutputChannel = this.serverOutputChannels.get(server.id);
        if (channel) {
            channel.show();
        }
    }

    refresh(data?): void {
        this._onDidChangeTreeData.fire(data);
    }

    addLocation(): Thenable<Protocol.Status> {
        return window.showOpenDialog(<OpenDialogOptions>{
            canSelectFiles: false,
            canSelectMany: false,
            canSelectFolders: true,
            openLabel: 'Select desired server location'
        }).then(folders => {
                if (!folders) {
                    Promise.reject();
                } else if (folders.length === 1) {
                    return this.client.findServerBeans(folders[0].fsPath);
                }
            }
        ).then(serverBeans => {
            if (serverBeans && serverBeans.length > 0 && serverBeans[0].typeCategory && serverBeans[0].typeCategory !== 'UNKNOWN') {
                // Prompt for server name
                const options: InputBoxOptions = {
                    prompt: `Provide the server name`,
                    placeHolder: `Server name`,
                    validateInput: (value: string) => {
                        if (!value || value.trim().length === 0) {
                            return 'Cannot set empty server name';
                        }
                        if (this.servers.get(value)) {
                            return 'Cannot set duplicate server name';
                        }
                        return null;
                    }
                };

                return window.showInputBox(options).then(value => {
                    return { name: value, bean: serverBeans[0] };
                });
            } else {
                if (serverBeans) {
                    return Promise.reject('Cannot detect server in selected location!');
                }
            }
        }).then(async data => {
            if (data && data.name) {
               const status = await this.client.createServerAsync(data.bean, data.name);
               if (status.severity > 0) {
                   return Promise.reject(status.message);
               }
               return status;
            }
        });
    }

    getTreeItem(server: Protocol.ServerHandle): TreeItem {
        const status: number = this.serverStatus.get(server.id);
        const item: TreeItem = new TreeItem(`${server.id}:${server.type.visibleName}(${this.serverStatusEnum.get(status)})`);
        item.iconPath = Uri.file(path.join(__dirname, '../../images/server-light.png'));
        item.contextValue =  this.serverStatusEnum.get(status);
        return item;
    }

    getChildren(element?: Protocol.ServerHandle): Protocol.ServerHandle[] {
        if (element === undefined) {
            return Array.from(this.servers.values());
        }
    }
}