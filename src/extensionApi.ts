/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import { API } from './api/contract/api';
import { initClient } from './rsp/client';
import { DebugInfo } from './debug/debugInfo';
import { DebugInfoProvider } from './debug/debugInfoProvider';
import { JavaDebugSession } from './debug/javaDebugSession';
import { Protocol, RSPClient, ServerState, StatusSeverity } from 'rsp-client';
import { RSPProviderAPI } from './api/contract/rspProviderAPI';
import { ServerAPI, ServerInfo } from './rsp/server';
import { ServerEditorAdapter } from './serverEditorAdapter';
import { DeployableStateNode, RSPProperties, RSPState, ServerExplorer, ServerStateNode } from './serverExplorer';
import * as vscode from 'vscode';

export interface ExtensionAPI {
    get(): API<RSPProviderAPI>;
}

export class CommandHandler {

    private static readonly LIST_RUNTIMES_TIMEOUT: number = 20000;
    private static readonly NO_SERVERS_FILTER: number = -1;

    private debugSession: JavaDebugSession;

    constructor(private explorer: ServerExplorer) {
        this.debugSession = new JavaDebugSession();
    }

    public async startRSP(context?: RSPState): Promise<void> {
        if (context === undefined) {
            const rsp = await this.selectRSP('Select RSP provider you want to start');
            if (!rsp || !rsp.id) return null;
            context = this.explorer.RSPServersStatus.get(rsp.id).state;
        }

        if (!(context.state === ServerState.STOPPED
            || context.state === ServerState.UNKNOWN)) {
            return Promise.reject(`The RSP server ${context.type.visibilename} is already running.`);
        }

        const rspProvider: ServerAPI = await this.activateExternalExtension(context.type.id);
        this.setRSPListener(context.type.id, rspProvider);
        const serverInfo: ServerInfo = await rspProvider.startRSP(
            (out: string) => this.onStdoutData(context.type.id, out),
            (err: string) => this.onStderrData(context.type.id, err)
        );

        if (!serverInfo || !serverInfo.port) {
            return Promise.reject(`Failed to start the ${context.type.visibilename} RSP server`);
        }

        const client = await initClient(serverInfo);

        const rspProperties: RSPProperties = this.explorer.RSPServersStatus.get(context.type.id);
        rspProperties.client = client;
        rspProperties.state.serverStates = [];
        this.explorer.RSPServersStatus.set(context.type.id, rspProperties);
        await this.activate(context.type.id, client);
        this.explorer.refreshTree();
    }

    public async stopRSP(forced: boolean, context?: RSPState): Promise<void> {
        if (context === undefined) {
            const rsp = await this.selectRSP('Select RSP provider you want to start');
            if (!rsp || !rsp.id) return null;
            context = this.explorer.RSPServersStatus.get(rsp.id).state;
        }

        if (context.state === ServerState.STARTED
            || context.state === ServerState.STARTING
            || context.state === ServerState.STOPPING) {
            this.explorer.updateRSPServer(context.type.id, ServerState.STOPPING);

            if (!forced) {
                const client: RSPClient = this.explorer.getClientByRSP(context.type.id);
                if (!client) {
                    return Promise.reject(`Failed to contact the RSP server ${context.type.visibilename}.`);
                }
                client.shutdownServer();
            } else {
                const rspProvider: ServerAPI = await this.activateExternalExtension(context.type.id);
                await rspProvider.stopRSP().catch(err => {
                    // if stopRSP fails, server is still running
                    this.explorer.updateRSPServer(context.type.id, ServerState.STARTED);
                    return Promise.reject(`Failed to terminate ${context.type.visibilename} - ${err}`);
                });
            }

            this.explorer.updateRSPServer(context.type.id, ServerState.STOPPED);
            this.explorer.disposeRSPProperties(context.type.id);
            this.explorer.refresh();
        } else {
            return Promise.reject(`The RSP server ${context.type.visibilename} is already stopped.`);
        }
    }

    public async startServer(mode: string, context?: ServerStateNode): Promise<Protocol.StartServerResponse> {
        if (context === undefined) {
            const rsp = await this.selectRSP('Select RSP provider you want to retrieve servers');
            if (!rsp || !rsp.id) return null;
            const serverId = await this.selectServer(rsp.id, 'Select server to start.');
            if (!serverId) return null;
            context = this.explorer.getServerStateById(rsp.id, serverId);
        }

        const serverState = this.explorer.getServerStateById(context.rsp, context.server.id).state;
        if (!(serverState === ServerState.STOPPED
            || serverState === ServerState.UNKNOWN)) {
            return Promise.reject('The server is already running.');
        }

        const client: RSPClient = this.explorer.getClientByRSP(context.rsp);
        if (!client) {
            return Promise.reject('Failed to contact the RSP server.');
        }

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

    public async stopServer(forced: boolean, context?: ServerStateNode): Promise<Protocol.Status> {
        if (context === undefined) {
            const rsp = await this.selectRSP('Select RSP provider you want to retrieve servers');
            if (!rsp || !rsp.id) return null;
            const serverId = await this.selectServer(rsp.id, 'Select server to stop.');
            if (!serverId) return null;
            context = this.explorer.getServerStateById(rsp.id, serverId);
        }

        const serverState = this.explorer.getServerStateById(context.rsp, context.server.id).state;
        if ((!forced && serverState === ServerState.STARTED)
            || (forced && (serverState === ServerState.STARTING
                            || serverState === ServerState.STOPPING))) {
            const client: RSPClient = this.explorer.getClientByRSP(context.rsp);
            if (!client) {
                return Promise.reject('Failed to contact the RSP server.');
            }
            const status = await client.getOutgoingHandler().stopServerAsync({ id: context.server.id, force: true });
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

    public async debugServer(context?: ServerStateNode): Promise<Protocol.StartServerResponse> {
        if (context === undefined) {
            const rsp = await this.selectRSP('Select RSP provider you want to retrieve servers');
            if (!rsp || !rsp.id) return null;
            const serverId = await this.selectServer(rsp.id, 'Select server to start.');
            if (!serverId) return;
            context = this.explorer.getServerStateById(rsp.id, serverId);
        }

        const client: RSPClient = this.explorer.getClientByRSP(context.rsp);
        if (!client) {
            return Promise.reject('Failed to contact the RSP server.');
        }
        const debugInfo: DebugInfo = await DebugInfoProvider.retrieve(context.server, client);
        const extensionIsRequired = await this.checkExtension(debugInfo);
        if (extensionIsRequired) {
            return Promise.reject(extensionIsRequired);
        }

        this.startServer('debug', context)
            .then(serverStarted => {
                if (!serverStarted
                    || !serverStarted.details) {
                    return Promise.reject(`Failed to start server ${context.server.id}`);
                }
                const port: string = DebugInfoProvider.create(serverStarted.details).getPort();
                this.debugSession.start(context.server, port, client);
                return Promise.resolve(serverStarted);
            });
    }

    public async removeServer(context?: ServerStateNode): Promise<Protocol.Status> {
        if (context === undefined) {
            const rsp = await this.selectRSP('Select RSP provider you want to retrieve servers');
            if (!rsp || !rsp.id) return null;
            const serverId = await this.selectServer(rsp.id, 'Select server to remove');
            if (!serverId) return null;
            context = this.explorer.getServerStateById(rsp.id, serverId);
        }

        const remove = await vscode.window.showWarningMessage(
            `Remove server ${context.server.id}?`, { modal: true }, 'Yes');
        return remove && this.removeStoppedServer(context.rsp, context.server);
    }

    private async removeStoppedServer(rspId: string, server: Protocol.ServerHandle): Promise<Protocol.Status> {
        const status1: ServerStateNode = this.explorer.getServerStateById(rspId, server.id);
        if (status1.state !== ServerState.STOPPED) {
            return Promise.reject(`Stop server ${server.id} before removing it.`);
        }
        const client: RSPClient = this.explorer.getClientByRSP(rspId);
        if (!client) {
            return Promise.reject('Failed to contact the RSP server.');
        }
        const status = await client.getOutgoingHandler().deleteServer({ id: server.id, type: server.type });
        if (!StatusSeverity.isOk(status)) {
            return Promise.reject(status.message);
        }
        return status;
    }

    public async showServerOutput(context?: ServerStateNode): Promise<void> {
        if (context === undefined) {
            const rsp = await this.selectRSP('Select RSP provider you want to retrieve servers');
            if (!rsp || !rsp.id) return null;
            const serverId = await this.selectServer(rsp.id, 'Select server to show output channel');
            if (!serverId) return null;
            context = this.explorer.getServerStateById(rsp.id, serverId);
        }
        this.explorer.showOutput(context);
    }

    public async restartServer(mode: string, context?: ServerStateNode): Promise<Protocol.StartServerResponse> {
        if (context === undefined) {
            const rsp = await this.selectRSP('Select RSP provider you want to retrieve servers');
            if (!rsp || !rsp.id) return null;
            const serverId: string = await this.selectServer(rsp.id, 'Select server to restart', ServerState.STARTED);
            if (!serverId) return null;
            context = this.explorer.getServerStateById(rsp.id, serverId);
        }

        return this.stopServer(false, context)
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

    public async addDeployment(context?: ServerStateNode): Promise<Protocol.Status> {
        if (context === undefined) {
            const rsp = await this.selectRSP('Select RSP provider you want to retrieve servers');
            if (!rsp || !rsp.id) return null;
            const serverId = await this.selectServer(rsp.id, 'Select server to deploy to');
            if (!serverId) return null;
            context = this.explorer.getServerStateById(rsp.id, serverId);
        }

        if (this.explorer) {
            return this.explorer.addDeployment(context);
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    public async removeDeployment(context?: DeployableStateNode): Promise<Protocol.Status> {
        if (context === undefined) {
            const rsp = await this.selectRSP('Select RSP provider you want to retrieve servers');
            if (!rsp || !rsp.id) return null;
            const serverId = await this.selectServer(rsp.id, 'Select server to remove deployment from');
            if (!serverId) return null;
            const deployables = this.explorer.getServerStateById(rsp.id, serverId).deployableStates.map(value => {
                return {
                    label: value.reference.label,
                    deployable: value
                };
            });
            const deployment = await vscode.window.showQuickPick(deployables, { placeHolder: 'Select deployment to remove' });
            if (!deployment || !deployment.deployable) return null;
            context = deployment.deployable;
        }

        return this.explorer.removeDeployment(context.rsp, context.server, context.reference);
    }

    public async fullPublishServer(context?: ServerStateNode): Promise<Protocol.Status> {
        if (context === undefined) {
            const rsp = await this.selectRSP('Select RSP provider you want to retrieve servers');
            if (!rsp || !rsp.id) return null;
            const serverId = await this.selectServer(rsp.id, 'Select server to publish');
            if (!serverId) return null;
            context = this.explorer.getServerStateById(rsp.id, serverId);
        }

        return this.explorer.publish(context.rsp, context.server, 2); // TODO use constant? Where is it?
    }

    public async createServer(context?: RSPState): Promise<Protocol.Status> {
        this.assertExplorerExists();
        if (context === undefined) {
            const rsp = await this.selectRSP('Select RSP provider you want to use to create a server');
            if (!rsp || !rsp.id) return;
            context = this.explorer.RSPServersStatus.get(rsp.id).state;
        }

        const download: string = await vscode.window.showQuickPick(['Yes', 'No, use server on disk'],
            { placeHolder: 'Download server?', ignoreFocusOut: true });
        if (!download) {
            return;
        }
        if (download.startsWith('Yes')) {
            return this.downloadRuntime(context.type.id);
        } else if (download.startsWith('No')) {
            return this.addLocation(context.type.id);
        }
    }

    private assertExplorerExists() {
        if (!this.explorer) {
            throw new Error('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    public async addLocation(rspId: string): Promise<Protocol.Status> {
        if (this.explorer) {
            if (!rspId) {
                const rsp = await this.selectRSP('Select RSP provider you want to use');
                if (!rsp || !rsp.id) return;
                rspId = rsp.id;
            }
            return this.explorer.addLocation(rspId);
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    public async downloadRuntime(rspId: string): Promise<Protocol.Status> {
        if (!rspId) {
            const rsp = await this.selectRSP('Select RSP provider you want to use');
            if (!rsp || !rsp.id) return;
            rspId = rsp.id;
        }

        const client = this.explorer.getClientByRSP(rspId);
        if (!client) {
            return Promise.reject('Failed to contact the RSP server.');
        }

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

    public async editServer(context?: ServerStateNode): Promise<void> {
        if (context === undefined) {
            const rsp = await this.selectRSP('Select RSP provider you want to retrieve servers');
            if (!rsp || !rsp.id) return null;
            const serverId = await this.selectServer(rsp.id, 'Select server you want to retrieve info about');
            if (!serverId) return null;
            context = this.explorer.getServerStateById(rsp.id, serverId);
        }

        if (this.explorer) {
            return this.explorer.editServer(context.rsp, context.server);
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    public async infoServer(context?: ServerStateNode): Promise<void> {
        if (context === undefined) {
            if (this.explorer) {
                const rsp = await this.selectRSP('Select RSP provider you want to retrieve servers');
                if (!rsp || !rsp.id) return null;
                const serverId = await this.selectServer(rsp.id, 'Select server you want to retrieve info about');
                if (!serverId) return null;
                context = this.explorer.getServerStateById(rsp.id, serverId);
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

    private async selectRSP(message: string): Promise<{ label: string; id: string; }> {
        const rspProviders = Array.from(this.explorer.RSPServersStatus.values()).map(rsp => {
            return {
                label: (!rsp.state.type.visibilename ?
                        rsp.state.type.id :
                        rsp.state.type.visibilename),
                id: rsp.state.type.id
            };
        });
        if (rspProviders.length < 1) {
            return Promise.reject('There are no RSP providers to choose from.');
        }
        return await vscode.window.showQuickPick(rspProviders, { placeHolder: message });
    }

    private async selectServer(rspId: string, message: string, stateFilter: number = CommandHandler.NO_SERVERS_FILTER): Promise<string> {
        let servers: ServerStateNode[] = this.explorer.getServerStatesByRSP(rspId);

        if (stateFilter >= 0) {
            servers = servers.filter(server => {
                return server.state === stateFilter;
            });
        }
        if (servers.length < 1) {
            return Promise.reject('There are no servers to choose from.');
        }

        return vscode.window.showQuickPick(servers.map(server => server.server.id), { placeHolder: message });
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

    private onStdoutData(rspId: string, data: string) {
        const rspserverstdout = this.explorer.getRSPOutputChannel(rspId);
        this.displayLog(rspserverstdout, data.toString());
    }

    private onStderrData(rspId: string, data: string) {
        const rspserverstderr = this.explorer.getRSPErrorChannel(rspId);
        this.displayLog(rspserverstderr, data.toString());
    }

    private displayLog(outputPanel: vscode.OutputChannel, message: string, show: boolean = true) {
        if (outputPanel) {
            if (show) outputPanel.show();
            outputPanel.appendLine(message);
        }
    }

    private async activateExternalExtension(id: string): Promise<ServerAPI> {
        const extension = await vscode.extensions.getExtension<ServerAPI>(id);
        if (!extension) {
            return Promise.reject(`Failed to retrieve ${id} extension`);
        }
        const rspProvider: ServerAPI = await extension.activate();
        if (!rspProvider) {
            return Promise.reject(`Failed to activate ${id} extension`);
        }
        return rspProvider;
    }

    public async setRSPListener(rspId: string, rspProvider: ServerAPI): Promise<void> {
        rspProvider.onRSPServerStateChanged(state => {
            this.explorer.updateRSPServer(rspId, state);
        });
    }

    public async activate(rspId: string, client: RSPClient): Promise<void> {
        client.getIncomingHandler().onServerAdded(handle => {
            this.explorer.insertServer(rspId, handle);
        });

        client.getIncomingHandler().onServerRemoved(handle => {
            this.explorer.removeServer(rspId, handle);
        });

        client.getIncomingHandler().onServerStateChanged(event => {
            this.explorer.updateServer(rspId, event);
        });

        client.getIncomingHandler().onServerProcessOutputAppended(event => {
            this.explorer.addServerOutput(event);
        });
    }
}
