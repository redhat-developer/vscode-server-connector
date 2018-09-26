import { ServerInfo } from './server';
import { ServersViewTreeDataProvider } from './serverExplorer';
import * as vscode from 'vscode';
import { Protocol, RSPClient, ServerState } from 'rsp-client';

export interface ExtensionAPI {
    readonly serverInfo: ServerInfo;
}

export class CommandHandler {

    private client: RSPClient;
    private serversData: ServersViewTreeDataProvider;

    constructor(serversData: ServersViewTreeDataProvider, client: RSPClient) {
        this.client = client;
        this.serversData = serversData;
    }

    async startServer(mode: string, context?: any): Promise<Protocol.StartServerResponse> {
        let selectedServerType: Protocol.ServerType;
        let selectedServerId: string;

        if (context === undefined) {
            selectedServerId = await vscode.window.showQuickPick(Array.from(this.serversData.servers.keys()),
                { placeHolder: 'Select runtime/server to start' });
            selectedServerType = this.serversData.servers.get(selectedServerId).type;
        } else {
            selectedServerType = context.type;
            selectedServerId = context.id;
        }

        if (this.serversData.serverStatus.get(selectedServerId) === ServerState.STOPPED) {
            const response = await this.client.startServerAsync({
                params: {
                    serverType: selectedServerType.id,
                    id: selectedServerId,
                    attributes: new Map<string, any>()
                },
                mode: mode
            });
            if (response.status.severity > 0) {
                return Promise.reject(response.status.message);
            }
            return response;
        } else {
            return Promise.reject('The server is already running.');
        }
    }

    async stopServer(context?: any): Promise<Protocol.Status> {
        let serverId: string;
        if (context === undefined) {
            serverId = await vscode.window.showQuickPick(Array.from(this.serversData.servers.keys()),
                { placeHolder: 'Select runtime/server to stop' });
        } else {
            serverId = context.id;
        }

        if (this.serversData.serverStatus.get(serverId) === ServerState.STARTED) {
            const status = await this.client.stopServerAsync({ id: serverId, force: true });
            if (status.severity > 0) {
                return Promise.reject(status.message);
            }
            return status;
        } else {
            return Promise.reject('The server is already stopped.');
        }
    }

    async removeServer(context?: any): Promise<Protocol.Status> {
        let serverId: string;
        let selectedServerType: Protocol.ServerType;
        if (context === undefined) {
            serverId = await vscode.window.showQuickPick(Array.from(this.serversData.servers.keys()),
                { placeHolder: 'Select runtime/server to remove' });
            selectedServerType = this.serversData.servers.get(serverId).type;
        } else {
            serverId = context.id;
            selectedServerType = context.type;
        }

        if (this.serversData.serverStatus.get(serverId) === ServerState.STOPPED) {
            const status = await this.client.deleteServerAsync({ id: serverId, type: selectedServerType });
            if (status.severity > 0) {
                return Promise.reject(status.message);
            }
            return status;
        } else {
            return Promise.reject('Please stop the server before removing it.');
        }
    }

    async showServerOutput(context?: any): Promise<void> {
        if (context === undefined) {
            const serverId = await vscode.window.showQuickPick(Array.from(this.serversData.servers.keys()),
                { placeHolder: 'Select runtime/server to show ouput channel' });
            context = this.serversData.servers.get(serverId);
        }
        this.serversData.showOutput(context);
    }

    async restartServer(context?: any): Promise<void> {
        if (context === undefined) {
            const serverId: string = await vscode.window.showQuickPick(
                Array.from(this.serversData.servers.keys())
                .filter(item => this.serversData.serverStatus.get(item) === ServerState.STARTED),
                { placeHolder: 'Select runtime/server to restart' }
            );
            context = this.serversData.servers.get(serverId);
        }

        const params: Protocol.LaunchParameters = {
            mode: 'run',
            params: {
                id: context.id,
                serverType: context.type.id,
                attributes: new Map<string, any>()
            }
        };

        await this.client.stopServerSync({ id: context.id, force: true });
        await this.client.startServerAsync(params);
    }

    async addLocation(): Promise<Protocol.Status> {
        if (this.serversData) {
            return this.serversData.addLocation();
        } else {
            return Promise.reject('Stack Protocol Server is starting, please try again later.');
        }
    }

    async activate(): Promise<void> {
        await this.client.connect();
        this.client.onServerAdded(handle => {
            this.serversData.insertServer(handle);
        });

        this.client.onServerRemoved(handle => {
            this.serversData.removeServer(handle);
        });

        this.client.onServerStateChange(event => {
            this.serversData.updateServer(event);
        });

        this.client.onServerOutputAppended(event => {
            this.serversData.addServerOutput(event);
        });
    }
}