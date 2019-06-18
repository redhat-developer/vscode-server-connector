/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import {
    Event,
    EventEmitter,
    InputBoxOptions,
    OpenDialogOptions,
    OutputChannel,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    TreeView,
    Uri,
    window,
    workspace
} from 'vscode';

import {
    Protocol,
    RSPClient,
    ServerState,
    StatusSeverity
} from 'rsp-client';
import { ServerEditorAdapter } from './serverEditorAdapter';
import { ServerIcon } from './serverIcon';

enum deploymentStatus {
    file = 'File',
    exploded = 'Exploded'
}

export interface ServerStateNode {
    rsp: string;
    server: Protocol.ServerHandle;
    state: number;
    publishState: number;
    runMode: string;
    deployableStates: Protocol.DeployableState[];
}

export interface RSPType {
    id: string;
    visibilename: string;
}

export interface RSPState {
    type: RSPType;
    state: number;
    serverStates: ServerStateNode[];
}

export interface RSPProviderUtils {
    state: RSPState;
    rspserverstdout: OutputChannel;
    rspserverstderr: OutputChannel;
    client: RSPClient;
}

export class ServerExplorer implements TreeDataProvider<RSPState | ServerStateNode | Protocol.DeployableState> {

    private _onDidChangeTreeData: EventEmitter<RSPState | ServerStateNode | undefined> = new EventEmitter<RSPState | ServerStateNode | undefined>();
    public readonly onDidChangeTreeData: Event<RSPState | ServerStateNode | undefined> = this._onDidChangeTreeData.event;
    public serverOutputChannels: Map<string, OutputChannel> = new Map<string, OutputChannel>();
    public runStateEnum: Map<number, string> = new Map<number, string>();
    public publishStateEnum: Map<number, string> = new Map<number, string>();
    private serverAttributes: Map<string, {required: Protocol.Attributes, optional: Protocol.Attributes}> =
        new Map<string, {required: Protocol.Attributes, optional: Protocol.Attributes}>();
    private readonly viewer: TreeView< RSPState | ServerStateNode | Protocol.DeployableState>;
    public RSPServersStatus: Map<string, RSPProviderUtils> = new Map<string, RSPProviderUtils>();
    //public serverRSPProvider: Map<string, string> = new Map<string, string>();

    constructor() {
        this.viewer = window.createTreeView('servers', { treeDataProvider: this }) ;

        this.runStateEnum
            .set(0, 'Unknown')
            .set(1, 'Starting')
            .set(2, 'Started')
            .set(3, 'Stopping')
            .set(4, 'Stopped');

        this.publishStateEnum
            .set(1, 'Synchronized')
            .set(2, 'Publish Required')
            .set(3, 'Full Publish Required')
            .set(4, '+ Publish Required')
            .set(5, '- Publish Required')
            .set(6, 'Unknown');
    }

    public initTreeRsp() {
        Array.from(this.RSPServersStatus.keys()).forEach(async id => {
            const client: RSPClient = this.getClientByRSP(id);
            const servers: Protocol.ServerHandle[] = await client.getOutgoingHandler().getServerHandles();
            await servers.forEach(async serverHandle => {
                const state = await client.getOutgoingHandler().getServerState(serverHandle);
                this.RSPServersStatus.get(id).state.serverStates.push({rsp: id, ...state});
                this.serverRSPProvider.set(serverHandle.id, id);
            });

            this.insertRSP(this.RSPServersStatus.get(id).state);
        });
    }

    private async insertRSP(rspState: RSPState) {
        this.refresh(rspState);
    }

    public async insertServer(rspId: string, event: Protocol.ServerHandle) {
        const client: RSPClient = this.getClientByRSP(rspId);
        const state = await client.getOutgoingHandler().getServerState(event);
        this.RSPServersStatus.get(rspId).state.serverStates.push({rsp: rspId, ...state});
        this.serverRSPProvider.set(state.server.id, rspId);
        this.refresh({rsp: rspId, ...state } as ServerStateNode);
    }

    public updateServer(event: ServerStateNode): void {
        this.serverRSPProvider.set(event.server.id, event.rsp);
        const indexServer: number = this.RSPServersStatus.get(event.rsp).state.serverStates.
                                            findIndex(state => state.server.id === event.server.id);
        this.RSPServersStatus.get(event.rsp).state.serverStates[indexServer] = event;
        this.refresh();
        const channel: OutputChannel = this.serverOutputChannels.get(event.server.id);
        if (event.state === ServerState.STARTING && channel) {
            channel.clear();
        }
    }

    public removeServer(rspId: string, handle: Protocol.ServerHandle): void {
        this.serverRSPProvider.delete(handle.id);
        this.RSPServersStatus.get(rspId).state.serverStates = this.RSPServersStatus.get(rspId).state.serverStates.
                                                                        filter(state => state.server.id !== handle.id);
        this.refresh();
        const channel: OutputChannel = this.serverOutputChannels.get(handle.id);
        this.serverOutputChannels.delete(handle.id);
        if (channel) {
            channel.clear();
            channel.dispose();
        }
    }

    public addServerOutput(output: Protocol.ServerProcessOutput): void {
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

    public showOutput(state: ServerStateNode): void {
        const channel: OutputChannel = this.serverOutputChannels.get(state.server.id);
        if (channel) {
            channel.show();
        }
    }

    public refresh(data?: RSPState | ServerStateNode): void {
        this._onDidChangeTreeData.fire();
        if (data !== undefined && this.isServerElement(data)) {
            this.selectNode(data);
        }
    }

    public selectNode(data: RSPState | ServerStateNode): void {
        this.viewer.reveal(data, { focus: true, select: true });
    }

    public async addDeployment(server: Protocol.ServerHandle): Promise<Protocol.Status> {
        const client: RSPClient = this.getClientByServer(server.id);
        return this.createOpenDialogOptions()
            .then(options => window.showOpenDialog(options))
            .then(async file => {
                if (file && file.length === 1) {

                    const answer = await window.showQuickPick(['No', 'Yes'], {placeHolder:
                        'Do you want to edit optional deployment parameters?'});
                    const options = {};
                    if (!answer) {
                        return;
                    }
                    if (answer === 'Yes') {
                        const optionMap: Protocol.Attributes = await client.getOutgoingHandler().listDeploymentOptions(server);
                        for (const key in optionMap.attributes) {
                            if (key) {
                                const attribute = optionMap.attributes[key];
                                const val = await window.showInputBox({prompt: attribute.description,
                                    value: attribute.defaultVal, password: attribute.secret});
                                if (val) {
                                    options[key] = val;
                                }
                            }
                        }
                    }

                    // var fileUrl = require('file-url');
                    // const filePath : string = fileUrl(file[0].fsPath);
                    const deployableRef: Protocol.DeployableReference = {
                        label: file[0].fsPath,
                        path: file[0].fsPath,
                        options: options
                    };
                    const req: Protocol.ServerDeployableReference = {
                        server: server,
                        deployableReference : deployableRef
                    };
                    const status = await client.getOutgoingHandler().addDeployable(req);
                    if (!StatusSeverity.isOk(status)) {
                        return Promise.reject(status.message);
                    }
                    return status;
                }
            });
    }

    private async createOpenDialogOptions(): Promise<OpenDialogOptions> {
        const showQuickPick: boolean = process.platform === 'win32' ||
                                       process.platform === 'linux';
        const filePickerType = await this.quickPickDeploymentType(showQuickPick);
        if (!filePickerType) {
            return Promise.reject();
        }
        // dialog behavior on different OS
        // Windows -> if both options (canSelectFiles and canSelectFolders) are true, fs only shows folders
        // Linux(fedora) -> if both options are true, fs shows both files and folders but files are unselectable
        // Mac OS -> if both options are true, it works correctly
        return {
            canSelectFiles: (showQuickPick ? filePickerType === deploymentStatus.file : true),
            canSelectMany: false,
            canSelectFolders: (showQuickPick ? filePickerType === deploymentStatus.exploded : true),
            openLabel: `Select ${filePickerType} Deployment`
        };
    }

    public async removeDeployment(server: Protocol.ServerHandle, deployableRef: Protocol.DeployableReference): Promise<Protocol.Status> {
        const client: RSPClient = this.getClientByServer(server.id);
        const req: Protocol.ServerDeployableReference = {
            server: server,
            deployableReference : deployableRef
        };
        const status = await client.getOutgoingHandler().removeDeployable(req);
        if (!StatusSeverity.isOk(status)) {
            return Promise.reject(status.message);
        }
        return status;
    }

    public async publish(server: Protocol.ServerHandle, type: number): Promise<Protocol.Status> {
        const client: RSPClient = this.getClientByServer(server.id);
        const req: Protocol.PublishServerRequest = { server: server, kind : type};
        const status = await client.getOutgoingHandler().publish(req);
        if (!StatusSeverity.isOk(status)) {
            return Promise.reject(status.message);
        }
        return status;
    }

    public async addLocation(rspId: string): Promise<Protocol.Status> {
        const client: RSPClient = this.getClientByRSP(rspId);
        const server: { name: string, bean: Protocol.ServerBean } = { name: null, bean: null };
        const folders = await window.showOpenDialog({
            canSelectFiles: false,
            canSelectMany: false,
            canSelectFolders: true,
            openLabel: 'Select desired server location'
        } as OpenDialogOptions);

        if (!folders
          || folders.length === 0) {
            return;
        }

        const serverBeans: Protocol.ServerBean[] =
          await client.getOutgoingHandler().findServerBeans({ filepath: folders[0].fsPath });

        if (!serverBeans
          || serverBeans.length === 0
          || !serverBeans[0].serverAdapterTypeId
          || !serverBeans[0].typeCategory
          || serverBeans[0].typeCategory === 'UNKNOWN') {
            throw new Error(`Could not detect any server at ${folders[0].fsPath}!`);
        }
        server.bean = serverBeans[0];
        server.name = await this.getServerName(rspId);
        const attrs = await this.getRequiredParameters(server.bean, client);
        await this.getOptionalParameters(server.bean, attrs);
        return this.createServer(server.bean, server.name, attrs, client);
    }

    public async editServer(server: Protocol.ServerHandle): Promise<void> {
        const client: RSPClient = this.getClientByServer(server.id);
        const serverProperties = await client.getOutgoingHandler().getServerAsJson(server);

        if (!serverProperties || !serverProperties.serverJson ) {
            return Promise.reject(`Could not load server properties for server ${server.id}`);
        }

        return ServerEditorAdapter.getInstance(this).showServerJsonResponse(serverProperties);
    }

    public async saveServerProperties(serverhandle: Protocol.ServerHandle, content: string): Promise<Protocol.Status> {
        if (!serverhandle || !content) {
            throw new Error(`Unable to update server properties for server ${serverhandle.id}`);
        }
        const client: RSPClient = this.getClientByServer(serverhandle.id);
        const serverProps: Protocol.UpdateServerRequest = {
            handle: serverhandle,
            serverJson: content
        };
        const response = await client.getOutgoingHandler().updateServer(serverProps);
        if (!StatusSeverity.isOk(response.validation.status)) {
            return Promise.reject(response.validation.status.message);
        }
        return response.validation.status;
    }

    private async createServer(bean: Protocol.ServerBean, name: string, attributes: any = {}, client: RSPClient): Promise<Protocol.Status> {
        if (!bean || !name) {
            throw new Error('Couldn\'t create server: no type or name provided.');
        }
        const response = await client.getServerCreation().createServerFromBeanAsync(bean, name, attributes);
        if (!StatusSeverity.isOk(response.status)) {
            throw new Error(response.status.message);
        }
        return response.status;
    }

    public getClientByRSP(rspId: string): RSPClient {
        return this.RSPServersStatus.get(rspId).client;
    }

    public getClientByServer(serverId: string): RSPClient {
        const rspId = this.serverRSPProvider.get(serverId);
        return this.RSPServersStatus.get(rspId).client;
    }

    public getRSPOutputChannel(server: string): OutputChannel {
        return this.RSPServersStatus.get(server).rspserverstdout;
    }

    public getRSPErrorChannel(server: string): OutputChannel {
        return this.RSPServersStatus.get(server).rspserverstderr;
    }

    /**
     * Prompts for server name
     */
    private async getServerName(rspId: string): Promise<string> {
        const options: InputBoxOptions = {
            prompt: `Provide the server name`,
            placeHolder: `Server name`,
            validateInput: (value: string) => {
                if (!value || value.trim().length === 0) {
                    return 'Cannot set empty server name';
                }
                if (this.RSPServersStatus.get(rspId).state.serverStates.find(state => state.server.id === value)) {
                    return 'Cannot set duplicate server name';
                }
            }
        };
        return await window.showInputBox(options);
    }

    /**
     * Requests parameters for the given server and lets user fill the required ones
     */
    private async getRequiredParameters(bean: Protocol.ServerBean, client: RSPClient): Promise<object> {
        let serverAttribute: {required: Protocol.Attributes; optional: Protocol.Attributes};

        if (this.serverAttributes.has(bean.serverAdapterTypeId)) {
            serverAttribute = this.serverAttributes.get(bean.serverAdapterTypeId);
        } else {
            const req = await client.getOutgoingHandler().getRequiredAttributes({id: bean.serverAdapterTypeId, visibleName: '', description: ''});
            const opt = await client.getOutgoingHandler().getOptionalAttributes({id: bean.serverAdapterTypeId, visibleName: '', description: ''});
            serverAttribute = { required: req, optional: opt };

            this.serverAttributes.set(bean.serverAdapterTypeId, serverAttribute);
        }
        const attributes = {};
        if (serverAttribute.optional
              && serverAttribute.optional.attributes
              && Object.keys(serverAttribute.optional.attributes).length > 0) {
            for (const key in serverAttribute.required.attributes) {
                if (key !== 'server.home.dir' && key !== 'server.home.file') {
                    const attribute = serverAttribute.required.attributes[key];
                    const value = await window.showInputBox({prompt: attribute.description,
                        value: attribute.defaultVal, password: attribute.secret});
                    if (value) {
                        attributes[key] = value;
                    }
                }
            }
        }
        return attributes;
    }

    /**
     * Let user choose to fill in optional parameters for a server
     */
    private async getOptionalParameters(bean: Protocol.ServerBean, attributes: object): Promise<object> {
        const serverAttribute = this.serverAttributes.get(bean.serverAdapterTypeId);
        if (serverAttribute.optional
              && serverAttribute.optional.attributes
              && Object.keys(serverAttribute.optional.attributes).length > 0) {
            const answer = await window.showQuickPick(['No', 'Yes'], {placeHolder: 'Do you want to edit optional parameters ?'});
            if (answer === 'Yes') {
                for (const key in serverAttribute.optional.attributes) {
                    if (key !== 'server.home.dir' && key !== 'server.home.file') {
                        const attribute = serverAttribute.optional.attributes[key];
                        const val = await window.showInputBox({prompt: attribute.description,
                            value: attribute.defaultVal, password: attribute.secret});
                        if (val) {
                            attributes[key] = val;
                        }
                    }
                }
            }
        }
        return attributes;
    }

    private async quickPickDeploymentType(showQuickPick: boolean): Promise<string> {
        // quickPick to solve a vscode api bug in windows that only opens file-picker dialog either in file or folder mode
        if (showQuickPick) {
            return await window.showQuickPick([deploymentStatus.file, deploymentStatus.exploded], {placeHolder:
                'What type of deployment do you want to add?'});
        }
        return 'file or exploded';
    }

    public getTreeItem(item: RSPState | ServerStateNode |  Protocol.DeployableState): TreeItem {
        if (this.isRSPElement(item)) {
            const state: RSPState = item as RSPState;
            const id1: string = state.type.visibilename;
            const serverState: string = this.runStateEnum.get(state.state);
            const depStr = `${id1} (${serverState})`;
            return { label: `${depStr}`,
                iconPath: Uri.file(path.join(__dirname, '../../images/server-light.png')),
                contextValue: serverState, //state.type.id, //to be removed, edited and change context menu actions
                collapsibleState: TreeItemCollapsibleState.Expanded
            };
        } else if (this.isServerElement(item)) {
            // item is a serverState
            const state: ServerStateNode = item as ServerStateNode;
            const handle: Protocol.ServerHandle = state.server;
            const id1: string = handle.id;
            const serverState: string = (state.state === ServerState.STARTED && state.runMode === ServerState.RUN_MODE_DEBUG) ?
                                    'Debugging' :
                                    this.runStateEnum.get(state.state);
            const pubState: string = this.publishStateEnum.get(state.publishState);
            const depStr = `${id1} (${serverState}) (${pubState})`;
            return { label: `${depStr}`,
                iconPath: ServerIcon.get(handle.type),
                contextValue: serverState,
                collapsibleState: TreeItemCollapsibleState.Expanded
            };
        } else if (this.isDeployableElement(item)) {
            const state: Protocol.DeployableState = item as Protocol.DeployableState;
            const id1: string = state.reference.label;
            const serverState: string = this.runStateEnum.get(state.state);
            const pubState: string = this.publishStateEnum.get(state.publishState);
            const depStr = `${id1} (${serverState}) (${pubState})`;
            return { label: `${depStr}`,
                iconPath: Uri.file(path.join(__dirname, '../../images/server-light.png')),
                contextValue: pubState,
                collapsibleState: TreeItemCollapsibleState.None
            };
        } else {
            return undefined;
        }
    }

    public getChildren(element?:  RSPState | ServerStateNode | Protocol.DeployableState):  RSPState[] | ServerStateNode[] | Protocol.DeployableState[] {
        if (element === undefined) {
            // no parent, root node -> return rsps
            return Array.from(this.RSPServersStatus.values()).map(rsp => rsp.state);
        } else if (this.isRSPElement(element) && (element as RSPState).serverStates !== undefined) {
            // rsp parent -> return servers
            return (element as RSPState).serverStates;
        } else if (this.isServerElement(element)) {
            // server parent -> return deployables
            return (element as ServerStateNode).deployableStates;
        } else {
            return [];
        }
    }

    public getParent(element?:  RSPState | ServerStateNode | Protocol.DeployableState): RSPState | ServerStateNode | Protocol.DeployableState {
        if (this.isServerElement(element)) {
            return this.getRSPState(element as ServerStateNode);
        } else if (this.isDeployableElement(element)) {
            return this.getServerState(element as Protocol.DeployableState);
        } else {
            return undefined;
        }
    }

    private getRSPState(element: ServerStateNode): RSPState {
        const rspId = this.serverRSPProvider.get(element.server.id);
        return this.RSPServersStatus.get(rspId).state;
    }

    private getServerState(element: Protocol.DeployableState): ServerStateNode {
        return this.getServerStateById(element.server.id);
    }

    public getServerStateById(serverId: string): ServerStateNode {
        const rspId = this.serverRSPProvider.get(serverId);
        return this.RSPServersStatus.get(rspId).state.serverStates.find(x => x.server.id === serverId);
    }

    public getServerStatesByRSP(rspId: string): ServerStateNode[] {
        return this.RSPServersStatus.get(rspId).state.serverStates;
    }

    private isRSPElement(element: RSPState | ServerStateNode | Protocol.DeployableState): boolean {
        return (element as RSPState).type !== undefined; // to be modified
    }

    private isServerElement(element: RSPState | ServerStateNode | Protocol.DeployableState): boolean {
        return (element as ServerStateNode).deployableStates !== undefined;
    }

    private isDeployableElement(element: RSPState | ServerStateNode | Protocol.DeployableState): boolean {
        return (element as Protocol.DeployableState).reference !== undefined;
    }

}
