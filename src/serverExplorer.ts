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
    Uri,
    TreeItemCollapsibleState
} from 'vscode';
import * as path from 'path';

import {
    RSPClient,
    Protocol,
    ServerState
} from 'rsp-client';

export class ServersViewTreeDataProvider implements TreeDataProvider< Protocol.ServerState | Protocol.DeployableState> {

    private _onDidChangeTreeData: EventEmitter<Protocol.ServerState | undefined> = new EventEmitter<Protocol.ServerState | undefined>();
    readonly onDidChangeTreeData: Event<Protocol.ServerState | undefined> = this._onDidChangeTreeData.event;
    private client: RSPClient;
    public serverStatus: Map<string, Protocol.ServerState> = new Map<string, Protocol.ServerState>();
    public serverOutputChannels: Map<string, OutputChannel> = new Map<string, OutputChannel>();
    public runStateEnum: Map<number, string> = new Map<number, string>();
    public publishStateEnum: Map<number, string> = new Map<number, string>();
    private serverAttributes: Map<String, {required: Protocol.Attributes; optional: Protocol.Attributes}> = new Map<String, {required: Protocol.Attributes; optional: Protocol.Attributes}>();

    constructor(client: RSPClient) {
        this.client = client;
        this.runStateEnum.set(0, 'Unknown');
        this.runStateEnum.set(1, 'Starting');
        this.runStateEnum.set(2, 'Started');
        this.runStateEnum.set(3, 'Stopping');
        this.runStateEnum.set(4, 'Stopped');

        this.publishStateEnum.set(1, 'Synchronized');
        this.publishStateEnum.set(2, 'Publish Required');
        this.publishStateEnum.set(3, 'Full Publish Required');
        this.publishStateEnum.set(4, '+ Publish Required');
        this.publishStateEnum.set(5, '- Publish Required');
        this.publishStateEnum.set(6, 'Unknown');

        client.getServerHandles().then(servers => servers.forEach(async server => this.insertServer(server)));
    }

    async insertServer(event: Protocol.ServerHandle) {
        const state = await this.client.getServerState(event);
        this.serverStatus.set(state.server.id, state);
        this.refresh();
    }

    updateServer(event: Protocol.ServerState): void {
        this.serverStatus.set(event.server.id, event);
        this.refresh();
        const channel: OutputChannel = this.serverOutputChannels.get(event.server.id);
        if (event.state === ServerState.STARTING && channel) {
            channel.clear();
        }
    }

    removeServer(handle: Protocol.ServerHandle): void {
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

    showOutput(state: Protocol.ServerState): void {
        const channel: OutputChannel = this.serverOutputChannels.get(state.server.id);
        if (channel) {
            channel.show();
        }
    }

    refresh(data?: Protocol.ServerState): void {
        this._onDidChangeTreeData.fire(data);
    }

    addDeployment(server: Protocol.ServerHandle): Thenable<Protocol.Status> {
        return window.showOpenDialog(<OpenDialogOptions>{
            canSelectFiles: true,
            canSelectMany: false,
            canSelectFolders: false,
            openLabel: 'Select Deployment'
        }).then(async file => {
            if (file && file.length === 1) {
                // var fileUrl = require('file-url');
                // const filePath : string = fileUrl(file[0].fsPath);
                const deployableRef: Protocol.DeployableReference = { label: file[0].fsPath,  path: file[0].fsPath};
                const req: Protocol.ModifyDeployableRequest = { server: server, deployable : deployableRef};
                const status = await this.client.addDeployable(req);
                if (status.severity > 0) {
                    return Promise.reject(status.message);
                }
                return status;
            }
        })
    }

    async removeDeployment(server: Protocol.ServerHandle, deployableRef: Protocol.DeployableReference): Promise<Protocol.Status> {
        const req : Protocol.ModifyDeployableRequest = { server: server, deployable : deployableRef};
        const status = await this.client.removeDeployable(req);
        if (status.severity > 0) {
            return Promise.reject(status.message);
        }
        return status;
    }

    async publish(server: Protocol.ServerHandle, type: number): Promise<Protocol.Status> {
        const req : Protocol.PublishServerRequest = { server: server, kind : type};
        const status = await this.client.publish(req);
        if (status.severity > 0) {
            return Promise.reject(status.message);
        }
        return status;
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
        .then(value => this.getRequiredParameters(value))
        .then(value => this.getOptionalParameters(value))
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
                        if (this.serverStatus.get(value)) {
                            return 'Cannot set duplicate server name';
                        }
                        return null;
                    }
                };
                return window.showInputBox(options).then(value => {
                    return Promise.resolve({ name: value, bean: serverBeans[0] });
                });
            } else {
                if (serverBeans) {
                    return Promise.reject('Cannot detect server in selected location!');
                }
            }
        };
    }

    private getRequiredParameters(value: { name: string; bean: Protocol.ServerBean}): Thenable<{ name: string; bean: Protocol.ServerBean; attributes: {}}> {
        let serverAttribute: Promise<{required: Protocol.Attributes; optional: Protocol.Attributes}>;

        if (this.serverAttributes.has(value.bean.serverAdapterTypeId)) {
            serverAttribute = Promise.resolve(this.serverAttributes.get(value.bean.serverAdapterTypeId));
        } else {
            let required: Protocol.Attributes;

            serverAttribute = this.client.getServerTypeRequiredAttributes({id: value.bean.serverAdapterTypeId, visibleName: '', description: ''})
            .then((req: Protocol.Attributes) => { required = req; return req;})
            .then(() => this.client.getServerTypeOptionalAttributes({id: value.bean.serverAdapterTypeId, visibleName: '', description: ''})
            .then(optional => Promise.resolve({required: required, optional: optional})))
            .then(server => {
                this.serverAttributes.set(value.bean.serverAdapterTypeId, server);
                return Promise.resolve(server);
            });
        }
        return serverAttribute.then(async (s) => {
            const attributes = {};
            for(const name in s.required.attributes) {
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

    getTreeItem(item: Protocol.ServerState |  Protocol.DeployableState): TreeItem {
        if ((<Protocol.ServerState>item).deployableStates) {
            // item is a serverState
            const state: Protocol.ServerState = <Protocol.ServerState>item;
            const handle: Protocol.ServerHandle = state.server;
            const id1: string = handle.id;
            const runState: string = this.runStateEnum.get(state.state);
            const pubState: string = this.publishStateEnum.get(state.publishState);
            const depStr = `${id1} (${runState}) (${pubState})`;
            const treeItem: TreeItem = new TreeItem(`${depStr}`, TreeItemCollapsibleState.Expanded);
            treeItem.iconPath = Uri.file(path.join(__dirname, '../../images/server-light.png'));
            treeItem.contextValue =  runState;
            return treeItem;
        } else if ((<Protocol.DeployableState>item).reference ) {
            const state: Protocol.DeployableState = <Protocol.DeployableState>item;
            const id1: string = state.reference.label;
            const runState: string = this.runStateEnum.get(state.state);
            const pubState: string = this.publishStateEnum.get(state.publishState);
            const depStr = `${id1} (${runState}) (${pubState})`;
            const treeItem: TreeItem = new TreeItem(`${depStr}`);
            treeItem.iconPath = Uri.file(path.join(__dirname, '../../images/server-light.png'));
            treeItem.contextValue =  pubState;
            return treeItem;
        }
    }

    private async getOptionalParameters(value: { name: string; bean: Protocol.ServerBean, attributes: any}): Promise<{ name: string; bean: Protocol.ServerBean; attributes: {}}> {
        const serverAttribute = this.serverAttributes.get(value.bean.serverAdapterTypeId);
        if (serverAttribute.optional && serverAttribute.optional.attributes) {
            const answer = await window.showQuickPick(['No', 'Yes'], {placeHolder: 'Do you want to edit optional parameters ?'});
            if (answer === 'Yes') {
                for(const name in serverAttribute.optional.attributes) {
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

    getChildren(element?:  Protocol.ServerState | Protocol.DeployableState):  Protocol.ServerState[] | Protocol.DeployableState[] {
        if (element === undefined) {
            return Array.from(this.serverStatus.values());
        }
        if( (<Protocol.ServerState>element).deployableStates ) {
            return (<Protocol.ServerState>element).deployableStates;
        }
    }
}