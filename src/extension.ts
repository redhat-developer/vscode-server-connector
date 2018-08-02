'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ServersViewTreeDataProvider } from './serverExplorer';
import * as server from './server';
import { ExtensionAPI ,IServer } from './extension.api';
import { SSPClient } from 'ssp-client';

const client = new SSPClient('localhost', 27511);

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext):  Promise<ExtensionAPI>  {
    let serversData: ServersViewTreeDataProvider;
    server.start(context).then(async () => {
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

        vscode.commands.registerCommand('server.stop', context => {
            client.stopServerAsync({id: context.id, force: true});
        });

        vscode.commands.registerCommand('server.remove', context => {
            client.deleteServerAsync({id: context.id, type: context.type});
        });

        vscode.commands.registerCommand('server.output', context => {
            serversData.showOutput(context);
        });

        // context.subscriptions.push(client);
        // Needs to add dispose:any to sspclient [Issue #2]
    });

    vscode.commands.registerCommand('servers.addLocation', () => {
        if (serversData) {
            serversData.addLocation();
        } else {
            vscode.window.showInformationMessage('Stack Protocol Server is starting, please try again later!');
        }
    });

    return {
        apiVersion: '0.1',
        server: {
            on(status: string, callback: Function) {
                // not impemented yet
            }
        },
        treeDataProvider: serversData
    };
}

// this method is called when your extension is deactivated
export function deactivate() {
}
