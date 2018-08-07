'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ServersViewTreeDataProvider } from './serverExplorer';
import * as server from './server';
import { SSPClient } from 'ssp-client';
import { LanguageClient, ServerOptions, TransportKind, LanguageClientOptions } from 'vscode-languageclient';

const client = new SSPClient('localhost', 27511);

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
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
    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    let serverOptions: ServerOptions = {
		run: { module: undefined, transport: TransportKind.ipc },
		debug: {
			module: undefined,
			transport: TransportKind.ipc,
			options: debugOptions
		}
    };
    let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'plaintext' }],
	};
    let sspclient = new LanguageClient('SSP Server (stdout)', serverOptions, clientOptions);
    context.subscriptions.push(
        // user commands
        vscode.commands.registerCommand('adapters.showOutputChannel', () => { sspclient.outputChannel.show(); }),
    );
}

// this method is called when your extension is deactivated
export function deactivate() {
}
