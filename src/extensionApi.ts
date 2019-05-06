/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import { EditorUtil } from './editorutil';
import { Protocol, RSPClient, ServerState, StatusSeverity } from 'rsp-client';
import { ServerInfo } from './server';
import { ServersViewTreeDataProvider } from './serverExplorer';
import * as vscode from 'vscode';

export interface ExtensionAPI {
    readonly serverInfo: ServerInfo;
}

export class CommandHandler {

    private static readonly LIST_RUNTIMES_TIMEOUT: number = 20000;

    private client: RSPClient;
    private serversData: ServersViewTreeDataProvider;
    private static readonly NO_SERVERS_FILTER: number = -1;

    constructor(serversData: ServersViewTreeDataProvider, client: RSPClient) {
        this.client = client;
        this.serversData = serversData;
    }

    public async startServer(mode: string, context?: Protocol.ServerState): Promise<Protocol.StartServerResponse> {
        let selectedServerType: Protocol.ServerType;
        let selectedServerId: string;

        if (context === undefined) {
            selectedServerId = await this.selectServer('Select server to start.');
            if (!selectedServerId) return null;
            selectedServerType = this.serversData.serverStatus.get(selectedServerId).server.type;
        } else {
            selectedServerType = context.server.type;
            selectedServerId = context.server.id;
        }

        const serverState = this.serversData.serverStatus.get(selectedServerId).state;
        if (serverState === ServerState.STOPPED || serverState === ServerState.UNKNOWN) {
            const response = await this.client.getOutgoingHandler().startServerAsync({
                params: {
                    serverType: selectedServerType.id,
                    id: selectedServerId,
                    attributes: new Map<string, any>()
                },
                mode: mode
            });
            if (!StatusSeverity.isOk(response.status)) {
                return Promise.reject(response.status.message);
            }
            return response;
        } else {
            return Promise.reject('The server is already running.');
        }
    }

    public async stopServer(context?: Protocol.ServerState): Promise<Protocol.Status> {
        let serverId: string;
        if (context === undefined) {
            serverId = await this.selectServer('Select server to stop.');
            if (!serverId) return null;
        } else {
            serverId = context.server.id;
        }

        const stateObj: Protocol.ServerState = this.serversData.serverStatus.get(serverId);
        if (stateObj.state === ServerState.STARTED) {
            const status = await this.client.getOutgoingHandler().stopServerAsync({ id: serverId, force: true });
            if (!StatusSeverity.isOk(status)) {
                return Promise.reject(status.message);
            }
            return status;
        } else {
            return Promise.reject('The server is already stopped.');
        }
    }

    public async debugServer(context?: Protocol.ServerState): Promise<Protocol.StartServerResponse> {

        if (vscode.extensions.getExtension('vscjava.vscode-java-debug') === undefined) {
            vscode.window.showErrorMessage('Debugger for Java extension is required. Install/Enable it before proceeding.');
            return;
        }

        // list all projects that belong to the current workspace allowing the user choose among them or pick a new one
        let optionsQuickPick: Array<{label: string, description: string}>  = [{ label: 'Add a new project', description: undefined}];
        if (vscode.workspace.workspaceFolders !== undefined) {
            optionsQuickPick = optionsQuickPick.concat(vscode.workspace.workspaceFolders.map(x => ({label: x.name, description: x.uri.toString()})));
        }

        let folderProject: vscode.Uri =  await vscode.window.showQuickPick(optionsQuickPick,
                                                { placeHolder: 'Select the project you want to debug', ignoreFocusOut: true }
                                        ).then(folder => {
                                            return (!folder || folder.description === undefined ? undefined : vscode.Uri.parse(folder.description));
                                        });

        if (!folderProject) {
            folderProject = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: false,
                canSelectFolders: true,
                openLabel: 'Open Project to debug'
            } as vscode.OpenDialogOptions).then(
                folder => {
                    if (folder != null && folder.length > 0) {
                        vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0,
                                                                null,
                                                                { uri: vscode.Uri.parse(folder[0].path) });
                        return folder[0];
                    }
                }
            );
        }

        if (!folderProject) return;

        return this.startServer('debug', context).then(
            status => {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(folderProject);
                vscode.debug.startDebugging(workspaceFolder,
                    {
                        type: 'java',
                        request: 'attach',
                        name: 'Debug (Remote)',
                        hostName: 'localhost',
                        port: `${status.details.properties['debug.details.port']}`
                    }
                );

                return status;
            }
        );

    }

    public async removeServer(context?: Protocol.ServerState): Promise<Protocol.Status> {
        let serverId: string;
        let selectedServerType: Protocol.ServerType;
        if (context === undefined) {
            serverId = await this.selectServer('Select server to remove');
            if (!serverId) return null;
            selectedServerType = this.serversData.serverStatus.get(serverId).server.type;
        } else {
            serverId = context.server.id;
            selectedServerType = context.server.type;
        }

        const remove = await vscode.window.showWarningMessage(
            `Remove server ${serverId}?`, { modal: true }, 'Yes');
        return remove && this.removeStoppedServer(serverId, selectedServerType);
    }

    private async removeStoppedServer(serverId: string, serverType: Protocol.ServerType): Promise<Protocol.Status> {
        const status1: Protocol.ServerState = this.serversData.serverStatus.get(serverId);
        if (status1.state !== ServerState.STOPPED) {
            return Promise.reject(`Stop server ${serverId} before removing it.`);
        }
        const status = await this.client.getOutgoingHandler().deleteServer({ id: serverId, type: serverType });
        if (!StatusSeverity.isOk(status)) {
            return Promise.reject(status.message);
        }
        return status;
    }

    public async showServerOutput(context?: Protocol.ServerState): Promise<void> {
        if (context === undefined) {
            const serverId = await this.selectServer('Select server to show output channel');
            if (!serverId) return null;
            context = this.serversData.serverStatus.get(serverId);
        }
        this.serversData.showOutput(context);
    }

    public async restartServer(context?: Protocol.ServerState): Promise<void> {
        if (context === undefined) {
            const serverId: string = await this.selectServer('Select server to restart', ServerState.STARTED);
            if (!serverId) return null;
            context = this.serversData.serverStatus.get(serverId);
        }

        const params: Protocol.LaunchParameters = {
            mode: 'run',
            params: {
                id: context.server.id,
                serverType: context.server.type.id,
                attributes: new Map<string, any>()
            }
        };

        await this.client.getOutgoingSyncHandler().stopServerSync({ id: context.server.id, force: true });
        await this.client.getOutgoingHandler().startServerAsync(params);
    }

    public async addDeployment(context?: Protocol.ServerState): Promise<Protocol.Status> {
        let serverId: string;
        if (context === undefined) {
            serverId = await this.selectServer('Select server to deploy to');
            if (!serverId) return null;
        } else {
            serverId = context.server.id;
        }

        if (this.serversData) {
            const serverHandle: Protocol.ServerHandle = this.serversData.serverStatus.get(serverId).server;
            return this.serversData.addDeployment(serverHandle);
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    public async removeDeployment(context?: Protocol.DeployableState): Promise<Protocol.Status> {
        let serverId: string;
        let deploymentId: string;
        if (context === undefined) {
            serverId = await this.selectServer('Select server to remove deployment from');
            if (!serverId) return null;

            const deployables = this.serversData.serverStatus.get(serverId).deployableStates.map(value => {
                return value.reference.label;
            });
            deploymentId = await vscode.window.showQuickPick(deployables, { placeHolder: 'Select deployment to remove' });
            if (!deploymentId) return null;
        } else {
            serverId = context.server.id;
            deploymentId = context.reference.label;
        }

        if (this.serversData) {
            const serverState: Protocol.ServerState = this.serversData.serverStatus.get(serverId);
            const serverHandle: Protocol.ServerHandle = serverState.server;
            const states: Protocol.DeployableState[] = serverState.deployableStates;
            for (const entry of states) {
                if ( entry.reference.label === deploymentId) {
                    return this.serversData.removeDeployment(serverHandle, entry.reference);
                }
            }
            return Promise.reject(`Cannot find deployment ${deploymentId}`);
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    public async fullPublishServer(context?: Protocol.ServerState): Promise<Protocol.Status> {
        let serverId: string;
        if (context === undefined) {
            serverId = await this.selectServer('Select server to publish');
            if (!serverId) return null;
        } else {
            serverId = context.server.id;
        }

        if (this.serversData) {
            const serverHandle: Protocol.ServerHandle = this.serversData.serverStatus.get(serverId).server;
            return this.serversData.publish(serverHandle, 2); // TODO use constant? Where is it?
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    public async createServer(): Promise<Protocol.Status> {
        this.assertServersDataExists();
        const download: string = await vscode.window.showQuickPick(['Yes', 'No, use server on disk'],
            { placeHolder: 'Download server?', ignoreFocusOut: true });
        if (!download) {
            return;
        }
        if (download.startsWith('Yes')) {
            return this.downloadRuntime();
        } else if (download.startsWith('No')) {
            return this.addLocation();
        }
    }

    private assertServersDataExists() {
        if (!this.serversData) {
            throw new Error('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    public async addLocation(): Promise<Protocol.Status> {
        if (this.serversData) {
            return this.serversData.addLocation();
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    public async downloadRuntime(): Promise<Protocol.Status> {
        const rtId: string = await this.promptDownloadableRuntimes();
        if (!rtId) {
            return;
        }
        let response1: Protocol.WorkflowResponse = await this.initEmptyDownloadRuntimeRequest(rtId);
        while (true) {
            if (StatusSeverity.isOk(response1.status)) {
                return Promise.resolve(response1.status);
            } else if (StatusSeverity.isError(response1.status)
                        || StatusSeverity.isCancel(response1.status)) {
                // error
                return Promise.reject(response1.status);
            }

            // not complete, not an error.
            const workflowMap = {};
            for (const item of response1.items) {
                if (this.isMultilineText(item.content) ) {
                    await new EditorUtil().showEditor(item.id, item.content);
                }

                const canceled: boolean = await this.promptUser(item, workflowMap);
                if (canceled) {
                    return;
                }
            }
            // Now we have a data map
            response1 = await this.initDownloadRuntimeRequest(rtId, workflowMap, response1.requestId);
        }
    }

    public async infoServer(context?: Protocol.ServerState): Promise<void> {
        if (context === undefined) {
            if (this.serversData) {
                const serverId = await this.selectServer('Select server you want to retrieve info about');
                if (!serverId) return null;
                context = this.serversData.serverStatus.get(serverId);
            } else {
                return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
            }
        }

        const selectedServerType: Protocol.ServerType = context.server.type;
        const selectedServerName: string = context.server.id;

        const outputChannel = vscode.window.createOutputChannel('vscode-adapter');
        outputChannel.show();
        outputChannel.appendLine(`Server Name: ${selectedServerName}`);
        outputChannel.appendLine(`Server Type Id: ${selectedServerType.id}`);
        outputChannel.appendLine(`Server Description: ${selectedServerType.visibleName}`);
    }

    private async selectServer(message: string, stateFilter: number = CommandHandler.NO_SERVERS_FILTER): Promise<string> {
        let servers = Array.from(this.serversData.serverStatus.keys());
        if (stateFilter >= 0) {
            servers = servers.filter(value => {
                return this.serversData.serverStatus.get(value).state === stateFilter;
            });
        }
        if (servers.length < 1) {
            return Promise.reject('There are no servers to choose from.');
        }

        return vscode.window.showQuickPick(servers, { placeHolder: message });
    }

    private async promptUser(item: Protocol.WorkflowResponseItem, workflowMap: {}): Promise<boolean> {
        const prompt = item.label + (item.content ? `\n${item.content}` : '');
        let userInput: any = null;
        if (item.responseType === 'none') {
            userInput = await vscode.window.showQuickPick(['Continue...'],
                { placeHolder: prompt, ignoreFocusOut: true });
        } else {
            if (item.responseType === 'bool') {
                const oneProp = await vscode.window.showQuickPick(['True', 'False'],
                    { placeHolder: prompt, ignoreFocusOut: true });
                userInput = (oneProp === 'True');
            } else {
                const oneProp = await vscode.window.showInputBox(
                    { prompt: prompt, ignoreFocusOut: true, password: item.responseSecret });
                if (item.responseType === 'int') {
                    userInput = +oneProp;
                } else {
                    userInput = oneProp;
                }
            }
        }

        workflowMap[item.id] = userInput;
        return userInput === undefined;
    }

    private isMultilineText(content: string) {
        return content && content.indexOf('\n') !== -1;
    }

    private async initDownloadRuntimeRequest(id: string, data1: {[index: string]: any}, reqId: number):
        Promise<Protocol.WorkflowResponse> {
        const req: Protocol.DownloadSingleRuntimeRequest = {
            requestId: reqId,
            downloadRuntimeId: id,
            data: data1
        };
        const resp: Promise<Protocol.WorkflowResponse> = this.client.getOutgoingHandler().downloadRuntime(req, 20000);
        return resp;
    }

    private async initEmptyDownloadRuntimeRequest(id: string): Promise<Protocol.WorkflowResponse> {
        const req: Protocol.DownloadSingleRuntimeRequest = {
            requestId: null,
            downloadRuntimeId: id,
            data: {}
        };
        const resp: Promise<Protocol.WorkflowResponse> = this.client.getOutgoingHandler().downloadRuntime(req);
        return resp;
    }

    private async promptDownloadableRuntimes(): Promise<string> {
        const newlist = this.client.getOutgoingHandler().listDownloadableRuntimes(CommandHandler.LIST_RUNTIMES_TIMEOUT)
            .then(async (list: Protocol.ListDownloadRuntimeResponse) => {
                const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
                const rts: Protocol.DownloadRuntimeDescription[] = list.runtimes.sort((runtimeA, runtimeB) => collator.compare(runtimeA.name, runtimeB.name));
                const newlist: any[] = [];
                for (const rt of rts) {
                    newlist.push({ label: rt.name, id: rt.id });
                }
                return newlist;
            });
        const answer = await vscode.window.showQuickPick(newlist,
            { placeHolder: 'Please choose a server to download.' });
        console.log(`${answer} was chosen`);
        if (!answer) {
            return null;
        } else {
            return answer.id;
        }
    }

    public async activate(): Promise<void> {
        this.client.getIncomingHandler().onServerAdded(handle => {
            this.serversData.insertServer(handle);
        });

        this.client.getIncomingHandler().onServerRemoved(handle => {
            this.serversData.removeServer(handle);
        });

        this.client.getIncomingHandler().onServerStateChanged(event => {
            this.serversData.updateServer(event);
        });

        this.client.getIncomingHandler().onServerProcessOutputAppended(event => {
            this.serversData.addServerOutput(event);
        });
    }
}
