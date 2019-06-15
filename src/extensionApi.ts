/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import { DebugInfo } from './debug/debugInfo';
import { DebugInfoProvider } from './debug/debugInfoProvider';
import { JavaDebugSession } from './debug/javaDebugSession';
import { Protocol, RSPClient, ServerState, StatusSeverity } from 'rsp-client';
import { ServerInfo } from './server';
import { ServerEditorAdapter } from './serverEditorAdapter';
import { ServerExplorer } from './serverExplorer';
import * as vscode from 'vscode';

export interface ExtensionAPI {
    readonly serverInfo: ServerInfo;
}

export class CommandHandler {

    private static readonly LIST_RUNTIMES_TIMEOUT: number = 20000;
    private static readonly NO_SERVERS_FILTER: number = -1;

    private debugSession: JavaDebugSession;

    constructor(private explorer: ServerExplorer) {
        //this.debugSession = new JavaDebugSession(client);
    }

    public async startServer(mode: string, context?: Protocol.ServerState): Promise<Protocol.StartServerResponse> {
        if (context === undefined) {
            const selectedServerId = await this.selectServer('Select server to start.');
            if (!selectedServerId) return null;
            context = this.explorer.serverStatus.get(selectedServerId);
        }

        const serverState = await this.explorer.serverStatus.get(context.server.id).state;
        if (!(serverState === ServerState.STOPPED
            || serverState === ServerState.UNKNOWN)) {
            return Promise.reject('The server is already running.');
        }

        const client: RSPClient = this.explorer.getClient(context.server.id);

        const response = await client.getOutgoingHandler().startServerAsync({
            params: {
                serverType: context.server.type.id,
                id: context.server.id,
                attributes: new Map<string, any>()
            },
            mode: mode
        });
        if (!StatusSeverity.isOk(response.status)) {
            return Promise.reject(response.status.message);
        }
        return response;
    }

    public async stopServer(forced: boolean, context?: Protocol.ServerState): Promise<Protocol.Status> {
        let serverId: string;
        if (context === undefined) {
            serverId = await this.selectServer('Select server to stop.');
            if (!serverId) return null;
        } else {
            serverId = context.server.id;
        }

        const stateObj: Protocol.ServerState = this.explorer.serverStatus.get(serverId);
        if ((!forced && stateObj.state === ServerState.STARTED)
            || (forced && (stateObj.state === ServerState.STARTING
                            || stateObj.state === ServerState.STOPPING))) {
            const client: RSPClient = this.explorer.getClient(context.server.id);
            const status = await client.getOutgoingHandler().stopServerAsync({ id: serverId, force: true });
            if (this.debugSession.isDebuggerStarted()) {
                await this.debugSession.stop();
            }
            if (!StatusSeverity.isOk(status)) {
                return Promise.reject(status.message);
            }
            return status;
        } else {
            return Promise.reject('The server is already stopped.');
        }
    }

    public async debugServer(context?: Protocol.ServerState): Promise<Protocol.StartServerResponse> {
        if (context === undefined) {
            const selectedServerId = await this.selectServer('Select server to start.');
            if (!selectedServerId) return;
            context = this.explorer.serverStatus.get(selectedServerId);
        }

        const client: RSPClient = this.explorer.getClient(context.server.id);
        const debugInfo: DebugInfo = await DebugInfoProvider.retrieve(context.server, client);
        const extensionIsRequired = await this.checkExtension(debugInfo);
        if (extensionIsRequired) {
            vscode.window.showErrorMessage(extensionIsRequired);
            return;
        }

        this.startServer('debug', context)
            .then(serverStarted => {
                if (!serverStarted
                    || !serverStarted.details) {
                    return Promise.reject(`Failed to start server ${context.server.id}`);
                }
                const port: string = DebugInfoProvider.create(serverStarted.details).getPort();
                this.debugSession.start(context.server, port);
                return Promise.resolve(serverStarted);
            });
    }

    public async removeServer(context?: Protocol.ServerState): Promise<Protocol.Status> {
        let serverId: string;
        let selectedServerType: Protocol.ServerType;
        if (context === undefined) {
            serverId = await this.selectServer('Select server to remove');
            if (!serverId) return null;
            selectedServerType = this.explorer.serverStatus.get(serverId).server.type;
        } else {
            serverId = context.server.id;
            selectedServerType = context.server.type;
        }

        const remove = await vscode.window.showWarningMessage(
            `Remove server ${serverId}?`, { modal: true }, 'Yes');
        return remove && this.removeStoppedServer(serverId, selectedServerType);
    }

    private async removeStoppedServer(serverId: string, serverType: Protocol.ServerType): Promise<Protocol.Status> {
        const status1: Protocol.ServerState = this.explorer.serverStatus.get(serverId);
        if (status1.state !== ServerState.STOPPED) {
            return Promise.reject(`Stop server ${serverId} before removing it.`);
        }
        const client: RSPClient = this.explorer.getClient(serverId);
        const status = await client.getOutgoingHandler().deleteServer({ id: serverId, type: serverType });
        if (!StatusSeverity.isOk(status)) {
            return Promise.reject(status.message);
        }
        return status;
    }

    public async showServerOutput(context?: Protocol.ServerState): Promise<void> {
        if (context === undefined) {
            const serverId = await this.selectServer('Select server to show output channel');
            if (!serverId) return null;
            context = this.explorer.serverStatus.get(serverId);
        }
        this.explorer.showOutput(context);
    }

    public async restartServer(mode: string, context?: Protocol.ServerState): Promise<Protocol.StartServerResponse> {
        if (context === undefined) {
            const serverId: string = await this.selectServer('Select server to restart', ServerState.STARTED);
            if (!serverId) return null;
            context = this.explorer.serverStatus.get(serverId);
        }

        return this.stopServer(false)
            .then(() => {
                if (mode === 'debug') {
                    return this.debugServer(context);
                } else if (mode === 'run') {
                    return this.startServer('run', context);
                } else {
                    return Promise.reject(`Could not restart server: unknown mode ${mode}`);
                }
            });
    }

    public async addDeployment(context?: Protocol.ServerState): Promise<Protocol.Status> {
        let serverId: string;
        if (context === undefined) {
            serverId = await this.selectServer('Select server to deploy to');
            if (!serverId) return null;
        } else {
            serverId = context.server.id;
        }

        if (this.explorer) {
            const serverHandle: Protocol.ServerHandle = this.explorer.serverStatus.get(serverId).server;
            return this.explorer.addDeployment(serverHandle);
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

            const deployables = this.explorer.serverStatus.get(serverId).deployableStates.map(value => {
                return value.reference.label;
            });
            deploymentId = await vscode.window.showQuickPick(deployables, { placeHolder: 'Select deployment to remove' });
            if (!deploymentId) return null;
        } else {
            serverId = context.server.id;
            deploymentId = context.reference.label;
        }

        if (this.explorer) {
            const serverState: Protocol.ServerState = this.explorer.serverStatus.get(serverId);
            const serverHandle: Protocol.ServerHandle = serverState.server;
            const states: Protocol.DeployableState[] = serverState.deployableStates;
            for (const entry of states) {
                if ( entry.reference.label === deploymentId) {
                    return this.explorer.removeDeployment(serverHandle, entry.reference);
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

        if (this.explorer) {
            const serverHandle: Protocol.ServerHandle = this.explorer.serverStatus.get(serverId).server;
            return this.explorer.publish(serverHandle, 2); // TODO use constant? Where is it?
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    public async createServer(rspProvider: object): Promise<Protocol.Status> {
        this.assertExplorerExists();
        const download: string = await vscode.window.showQuickPick(['Yes', 'No, use server on disk'],
            { placeHolder: 'Download server?', ignoreFocusOut: true });
        if (!download) {
            return;
        }
        if (download.startsWith('Yes')) {
            return this.downloadRuntime(rspProvider.toString());
        } else if (download.startsWith('No')) {
            return this.addLocation();
        }
    }

    private assertExplorerExists() {
        if (!this.explorer) {
            throw new Error('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    public async addLocation(): Promise<Protocol.Status> {
        if (this.explorer) {
            return this.explorer.addLocation();
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    public async downloadRuntime(rspProvider: string): Promise<Protocol.Status> {
        const client = this.explorer.getClient(rspProvider);
        const rtId: string = await this.promptDownloadableRuntimes(client);
        if (!rtId) {
            return;
        }
        let response: Protocol.WorkflowResponse = await this.initEmptyDownloadRuntimeRequest(rtId, client);
        while (true) {
            if (StatusSeverity.isOk(response.status)) {
                return Promise.resolve(response.status);
            } else if (StatusSeverity.isError(response.status)
                        || StatusSeverity.isCancel(response.status)) {
                // error
                return Promise.reject(response.status);
            }

            // not complete, not an error.
            const workflowMap = {};
            for (const item of response.items) {
                if (this.isMultilineText(item.content) ) {
                    await ServerEditorAdapter.getInstance(this.explorer).showEditor(item.id, item.content);
                }

                const canceled: boolean = await this.promptUser(item, workflowMap);
                if (canceled) {
                    return;
                }
            }
            // Now we have a data map
            response = await this.initDownloadRuntimeRequest(rtId, workflowMap, response.requestId, client);
        }
    }

    public async editServer(context?: Protocol.ServerState): Promise<void> {
        if (context === undefined) {
            if (this.explorer) {
                const serverId = await this.selectServer('Select server you want to retrieve info about');
                if (!serverId) return null;
                context = this.explorer.serverStatus.get(serverId);
            } else {
                return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
            }
        }

        if (this.explorer) {
            const serverHandle: Protocol.ServerHandle = this.explorer.serverStatus.get(context.server.id).server;
            return this.explorer.editServer(serverHandle);
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    public async infoServer(context?: Protocol.ServerState): Promise<void> {
        if (context === undefined) {
            if (this.explorer) {
                const serverId = await this.selectServer('Select server you want to retrieve info about');
                if (!serverId) return null;
                context = this.explorer.serverStatus.get(serverId);
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
        let servers = Array.from(this.explorer.serverStatus.keys());
        if (stateFilter >= 0) {
            servers = servers.filter(value => {
                return this.explorer.serverStatus.get(value).state === stateFilter;
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

    private async initDownloadRuntimeRequest(id: string, data1: {[index: string]: any}, reqId: number, client: RSPClient):
        Promise<Protocol.WorkflowResponse> {
        const req: Protocol.DownloadSingleRuntimeRequest = {
            requestId: reqId,
            downloadRuntimeId: id,
            data: data1
        };

        const resp: Promise<Protocol.WorkflowResponse> = client.getOutgoingHandler().downloadRuntime(req, 20000);
        return resp;
    }

    private async initEmptyDownloadRuntimeRequest(id: string, client: RSPClient): Promise<Protocol.WorkflowResponse> {
        const req: Protocol.DownloadSingleRuntimeRequest = {
            requestId: null,
            downloadRuntimeId: id,
            data: {}
        };
        const resp: Promise<Protocol.WorkflowResponse> = client.getOutgoingHandler().downloadRuntime(req);
        return resp;
    }

    private async promptDownloadableRuntimes(client: RSPClient): Promise<string> {
        const newlist = client.getOutgoingHandler().listDownloadableRuntimes(CommandHandler.LIST_RUNTIMES_TIMEOUT)
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

    private async checkExtension(debugInfo: DebugInfo): Promise<string> {
        if (!debugInfo) {
            return `Could not find server debug info.`;
        }

        if (!debugInfo.isJavaType()) {
            return `Vscode-Adapters doesn\'t support debugging with ${debugInfo.getType()} language at this time.`;
        }

        if (this.hasJavaDebugExtension()) {
            return 'Debugger for Java extension is required. Install/Enable it before proceeding.';
        }
    }

    private hasJavaDebugExtension(): boolean {
        return vscode.extensions.getExtension('vscjava.vscode-java-debug') === undefined;
    }

    public async activate(): Promise<void> {
        this.client.getIncomingHandler().onServerAdded(handle => {
            this.explorer.insertServer(handle);
        });

        this.client.getIncomingHandler().onServerRemoved(handle => {
            this.explorer.removeServer(handle);
        });

        this.client.getIncomingHandler().onServerStateChanged(event => {
            this.explorer.updateServer(event);
        });

        this.client.getIncomingHandler().onServerProcessOutputAppended(event => {
            this.explorer.addServerOutput(event);
        });
    }
}
