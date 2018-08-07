'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ServersViewTreeDataProvider } from './serverExplorer';
import * as server from './server';
import { SSPClient } from 'ssp-client';

const client = new SSPClient('localhost', 27511);

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    let serversData: ServersViewTreeDataProvider;
    const startPromise = server.start(context).then(async (connInfo) => {

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
        vscode.commands.registerCommand('server.start', context => {
            client.startServerAsync({
                params: {
                    serverType: context.type.id,
                    id: context.id,
                    attributes: new Map<string, any>()
                },
                mode: 'run'});
            });

        vscode.commands.registerCommand('server.stop', async context => {
            if (context === undefined) {
                const serverId: any = await vscode.window.showQuickPick(serversData.servers.map((server: any) => ({label: server.id})), {placeHolder: 'Select runtime/server to Stop'});
                if (serversData.serverStatus.get(serverId.label) === 2) {
                    client.stopServerAsync({id: serverId.label, force: true});
                } else {
                    vscode.window.showInformationMessage('The server is already in stopped state !!');
                }
            } else {
                client.stopServerAsync({id: context.id, force: true});
            }
        });

        vscode.commands.registerCommand('server.remove', async context => {
            if (context === undefined) {
                const serverId: any = await vscode.window.showQuickPick(serversData.servers.map((server: any) => ({label: server.id})), {placeHolder: 'Select runtime/server to Remove'});
                if (serversData.serverStatus.get(serverId.label) === 4) {
                    client.deleteServerAsync({id: serverId.label, type: serverId.type});
                } else {
                    vscode.window.showInformationMessage('Please stop the server and then remove it !!');
                }
            } else {
                client.deleteServerAsync({id: context.id, type: context.type});
            }
        });

        vscode.commands.registerCommand('server.output', async context => {
            serversData.showOutput(context);
        });

        vscode.commands.registerCommand('servers.addLocation', () => {
            if (serversData) {
                serversData.addLocation();
            } else {
                vscode.window.showInformationMessage('Stack Protocol Server is starting, please try again later!');
            }
        });

        // context.subscriptions.push(client);
        // Needs to add dispose:any to sspclient [Issue #2]
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
