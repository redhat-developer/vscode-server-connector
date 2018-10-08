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
    private serverAttributes: Map<String, {required: Protocol.Attributes; optional: Protocol.Attributes}> = new Map<String, {required: Protocol.Attributes; optional: Protocol.Attributes}>();

    constructor(client: RSPClient) {
        this.client = client;
        this.serverStatusEnum.set(0, 'Unknown');
        this.serverStatusEnum.set(1, 'Starting');
        this.serverStatusEnum.set(2, 'Started');
        this.serverStatusEnum.set(3, 'Stopping');
        this.serverStatusEnum.set(4, 'Stopped');
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
        })
        .then(folders => {
            if (folders && folders.length === 1) {
                return this.client.findServerBeans(folders[0].fsPath);
            }
        })
        .then(this.getServerName())
        .then((value) => this.getRequiredParameters(value))
        .then((value) => this.getOptionalParameters(value))
        .then(this.createServerAsync());
    }

    private createServerAsync(): (value: { name: string; bean: Protocol.ServerBean; attributes: {}}) => Thenable<Protocol.Status> {
        return async (data) => {
            if (data && data.name) {
                const status = await this.client.createServerAsync(data.bean, data.name, data.attributes);
                if (status.severity > 0) {
                    return Promise.reject(status.message);
                }
                return Promise.resolve(status);
            }
        };
    }

    private getServerName(): (value: Protocol.ServerBean[]) => Thenable<{ name: string; bean: Protocol.ServerBean; }> {
        return serverBeans => {
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
                    return Promise.resolve({ name: value, bean: serverBeans[0] });
                });
            }
            else {
                return Promise.reject('Cannot detect server in selected location!');
            }
        };
    }

    private getRequiredParameters(value: { name: string; bean: Protocol.ServerBean}): Thenable<{ name: string; bean: Protocol.ServerBean; attributes: {}}> {
        var serverAttribute: Promise<{required: Protocol.Attributes; optional: Protocol.Attributes}>;

        if (this.serverAttributes.has(value.bean.serverAdapterTypeId)) {
            serverAttribute = Promise.resolve(this.serverAttributes.get(value.bean.serverAdapterTypeId));
        } else {
            var required: Protocol.Attributes;

            serverAttribute = this.client.getServerTypeRequiredAttributes({id: value.bean.serverAdapterTypeId, visibleName: '', description: ''})
            .then((req: Protocol.Attributes) => { required = req; return req;})
            .then(() => this.client.getServerTypeOptionalAttributes({id: value.bean.serverAdapterTypeId, visibleName: '', description: ''})
            .then((optional) => Promise.resolve({required: required, optional: optional})))
            .then((server) => {
                this.serverAttributes.set(value.bean.serverAdapterTypeId, server);
                return Promise.resolve(server);
            });
        }
        return serverAttribute.then(async (s) => {
            const attributes = {};
            for(var name in s.required.attributes) {
                if (name !== 'server.home.dir' && name !== 'server.home.file') {
                    const attribute = s.required.attributes[name];
                    const value = await window.showInputBox({prompt: attribute.description, value: attribute.defaultVal});
                    if (value) {
                        attributes[name] = value;
                    }
                }
            }
            return Promise.resolve({name: value.name, bean: value.bean, attributes: attributes});
        });
    }

    private async getOptionalParameters(value: { name: string; bean: Protocol.ServerBean, attributes: any}): Promise<{ name: string; bean: Protocol.ServerBean; attributes: {}}> {
        const serverAttribute = this.serverAttributes.get(value.bean.serverAdapterTypeId);
        if (serverAttribute.optional && serverAttribute.optional.attributes) {
            const answer = await window.showQuickPick(['No', 'Yes'], {placeHolder: 'Do you want to edit optional parameters ?'});
            if (answer === 'Yes') {
                for(var name in serverAttribute.optional.attributes) {
                    if (name !== 'server.home.dir' && name !== 'server.home.file') {
                        const attribute = serverAttribute.optional.attributes[name];
                        const val = await window.showInputBox({prompt: attribute.description, value: attribute.defaultVal});
                        if (val) {
                            value.attributes[name] = val;
                        }
                    }
                }
            }
        }
        return Promise.resolve(value);
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