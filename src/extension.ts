'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ServersViewTreeDataProvider } from './serverExplorer';
import * as server from './server';
import { SSPClient, Protocol, ServerState } from 'ssp-client';

const client = new SSPClient('localhost', 27511);

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    let serversData: ServersViewTreeDataProvider;
    let selectedServerType: Protocol.ServerType;
    let selectedServerId: string;
    const startPromise = server.start(context).then(async connInfo => {

        await client.connect();
        client.onServerAdded(handle => {
            serversData.insertServer(handle);
        });

        client.onServerRemoved(handle => {
            serversData.removeServer(handle);
        });

        client.onServerStateChange(event => {
            serversData.updateServer(event);
        });

        client.onServerOutputAppended(event => {
            serversData.addServerOutput(event);
        });

        serversData = new ServersViewTreeDataProvider(client);
        vscode.window.registerTreeDataProvider('servers', serversData);

        const subscriptions = [
            vscode.commands.registerCommand('server.start', async context => {
                if (context === undefined) {
                    const serverId: string = await vscode.window.showQuickPick(Array.from(serversData.servers.keys()), {placeHolder: 'Select runtime/server to start'});
                    if (serversData.serverStatus.get(serverId) === 4) {
                        selectedServerType = serversData.servers.get(serverId).type;
                        selectedServerId = serverId;
                    } else {
                        vscode.window.showInformationMessage('The server has to be in stopped state to start it!!');
                    }
                } else {
                    selectedServerType = context.type;
                    selectedServerId = context.id;
                }

                client.startServerAsync({
                    params: {
                        serverType: selectedServerType.id,
                        id: selectedServerId,
                        attributes: new Map<string, any>()
                    },
                    mode: 'run'
                });
            }),

            vscode.commands.registerCommand('server.stop', async context => {
                if (context === undefined) {
                    const serverId: string = await vscode.window.showQuickPick(Array.from(serversData.servers.keys()), {placeHolder: 'Select runtime/server to stop'});
                    if (serversData.serverStatus.get(serverId) === 2) {
                        client.stopServerAsync({id: serverId, force: true});
                    } else {
                        vscode.window.showInformationMessage('The server is already in stopped state !!');
                    }
                } else {
                    client.stopServerAsync({id: context.id, force: true});
                }
            }),

            vscode.commands.registerCommand('server.remove', async context => {
                if (context === undefined) {
                    const serverId: string = await vscode.window.showQuickPick(Array.from(serversData.servers.keys()), {placeHolder: 'Select runtime/server to remove'});
                    if (serversData.serverStatus.get(serverId) === 4) {
                        selectedServerType = serversData.servers.get(serverId).type;
                        client.deleteServerAsync({id: serverId, type: selectedServerType});
                    } else {
                        vscode.window.showInformationMessage('Please stop the server and then remove it !!');
                    }
                } else {
                    client.deleteServerAsync({id: context.id, type: context.type});
                }
            }),

            vscode.commands.registerCommand('server.output', async context => {
                if (context === undefined) {
                    const serverId: string = await vscode.window.showQuickPick(Array.from(serversData.servers.keys()), {placeHolder: 'Select runtime/server to show ouput channel'});
                    serversData.showOutput(serversData.servers.get(serverId));
                } else {
                    serversData.showOutput(context);
                }
            }),

            vscode.commands.registerCommand('servers.addLocation', () => {
                if (serversData) {
                    serversData.addLocation();
                } else {
                    vscode.window.showInformationMessage('Stack Protocol Server is starting, please try again later!');
                }
            }),

            vscode.commands.registerCommand('server.restart', async context => {
                if (context === undefined) {
                    const serverId: string = await vscode.window.showQuickPick(Array.from(serversData.servers.keys()).filter(item => serversData.serverStatus.get(item) === ServerState.STARTED), {placeHolder: 'Select runtime/server to restart'});
                    context = serversData.servers.get(serverId);
                }

                const params: Protocol.LaunchParameters = {
                    mode: 'run',
                    params: {
                        id: context.id,
                        serverType: context.type.id,
                        attributes: new Map<string, any>()
                    }
                };

                await client.stopServerSync({ id: context.id, force: true });
                await client.startServerAsync(params);
            })];

        subscriptions.forEach(element => {
            context.subscriptions.push(element);
        }, this);

        return connInfo;
    });

    return {
        start: startPromise,
        server: server
    };
}

// this method is called when your extension is deactivated
export function deactivate() {
}
