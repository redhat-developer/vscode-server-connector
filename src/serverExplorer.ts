import {
    TreeDataProvider,
    Event,
    TreeItem,
    window,
    OpenDialogOptions,
    InputBoxOptions,
    EventEmitter,
    OutputChannel,
    workspace
} from 'vscode';

import { SSPClient, Protocol, ServerState } from 'ssp-client';

export class ServersViewTreeDataProvider implements TreeDataProvider<Protocol.ServerHandle> {

    private _onDidChangeTreeData: EventEmitter<Protocol.ServerHandle | undefined> = new EventEmitter<Protocol.ServerHandle | undefined>();
    readonly onDidChangeTreeData: Event<Protocol.ServerHandle | undefined> = this._onDidChangeTreeData.event;
    private client: SSPClient;
    private servers: Protocol.ServerHandle[] = new Array<Protocol.ServerHandle>();
    private serverStatus: Map<string, number> = new Map<string, number>();
    private serverOutputChannels: Map<string, OutputChannel> = new Map<string, OutputChannel>();
    private serverStatusEnum: Map<number, string> = new Map<number, string>();

    constructor(client: SSPClient) {
        this.client = client;
        this.serverStatusEnum.set(0, 'Unknown');
        this.serverStatusEnum.set(1, 'Starting');
        this.serverStatusEnum.set(2, 'Started');
        this.serverStatusEnum.set(3, 'Stopping');
        this.serverStatusEnum.set(4, 'Stopped');
    }

    insertServer(handle) {
        this.servers.push(handle);
        this.serverStatus.set(handle.id, ServerState.STOPPED);
        this.refresh();
    }

    updateServer(event: Protocol.ServerStateChange) {
        this.servers.forEach(value => {
            if (value.id === event.server.id) {
                this.serverStatus.set(value.id, event.state);
                this.refresh(value);
                const channel: OutputChannel = this.serverOutputChannels.get(value.id);
                if (event.state === ServerState.STARTING && channel) {
                    channel.clear();
                }
            }
        });
    }

    removeServer(handle: Protocol.ServerHandle): any {
        this.servers.forEach((value, index) => {
            if (value.id === handle.id) {
                this.servers.splice(index, 1);
                this.serverStatus.delete(handle.id);
                this.refresh();
                const channel: OutputChannel = this.serverOutputChannels.get(handle.id);
                this.serverOutputChannels.delete(handle.id);
                channel.clear();
                channel.dispose();
            }
        });
    }

    addServerOutput(output: Protocol.ServerProcessOutput): any {
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

    showOutput(server: Protocol.ServerHandle): any {
        const channel: OutputChannel = this.serverOutputChannels.get(server.id);
        if (channel) {
            channel.show();
        }
    }

    refresh(data?): void {
        this._onDidChangeTreeData.fire(data);
    }

    addLocation(): any {
        window.showOpenDialog(<OpenDialogOptions>{
            canSelectFiles: false,
            canSelectMany: false,
            canSelectFolders: true,
            openLabel: 'Select desired server location'
        }).then(folders => {
            if (folders && folders.length === 1) {
                return this.client.findServerBeans( folders[0].fsPath );
            }
        }).then(serverBeans => {
            if (serverBeans && serverBeans.length > 0 && serverBeans[0].typeCategory && serverBeans[0].typeCategory !== 'UNKNOWN') {
                // Prompt for server name
                const options: InputBoxOptions = {
                    prompt: `Please provide the server name`,
                    placeHolder: `Server name`,
                    validateInput: (value: string) => {
                        if (!value || value.trim().length === 0) {
                            return 'Cannot set empty server name';
                        }
                        if (this.servers.some(server => server.id === value)) {
                            return 'Cannot set duplicate server name';
                        }
                        return null;
                    }
                };

                return window.showInputBox(options).then(value => {
                    return { name: value, bean: serverBeans[0] };
                });
            } else {
                window.showInformationMessage('Cannot detect server in selected location!');
            }
        }).then(data => {
            if (data && data.name) {
                return this.client.createServerAsync(data.bean, data.name);
            }
        }).then(status => {
            if (status) {
                console.log(status);
            }
        });
    }

    getTreeItem(server: Protocol.ServerHandle): TreeItem | Thenable<TreeItem> {
        const status: number = this.serverStatus.get(server.id);
        const item: TreeItem = new TreeItem(`${server.id}:${server.type.visibleName}(${this.serverStatusEnum.get(status)})`);
        item.contextValue =  this.serverStatusEnum.get(status);
        return item;
    }

    getChildren(element?: Protocol.ServerHandle | undefined): Protocol.ServerHandle[] | Thenable<Protocol.ServerHandle[] | null | undefined> | null | undefined {
        if (element === undefined) {
            return this.servers;
        }
    }
}