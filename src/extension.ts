'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ServersViewTreeDataProvider } from './serverExplorer';
// import { LanguageClient, LanguageClientOptions, RevealOutputChannelOn, StreamInfo} from 'vscode-languageclient';
import * as net from 'net';
import * as rpc from 'vscode-jsonrpc';
import { ServerAddedNotification, ServerStateChangeNotification, StartServerAsyncNotification, StopServerAsyncNotification, ServerRemovedNotification, DeleteServerNotification, ServerProcessOutputAppendedNotification } from './protocol';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const connectionInfo = {
        port: 27511,
        host: 'localhost'
    };

    const socket = net.connect(connectionInfo).on('connect', async () => {
        const connection = rpc.createMessageConnection(
            new rpc.StreamMessageReader(socket),
            new rpc.StreamMessageWriter(socket));

        connection.listen();

        connection.onNotification(ServerAddedNotification.type, handle => {
            serversData.insertServer(handle);
        });

        connection.onNotification(ServerRemovedNotification.type, handle => {
            serversData.removeServer(handle);
        });

        connection.onNotification(ServerStateChangeNotification.type, event => {
            serversData.updateServer(event);
        });

        connection.onNotification(ServerProcessOutputAppendedNotification.type, event => {
            serversData.addServerOutput(event);
        });

        const serversData = new ServersViewTreeDataProvider(connection);
        vscode.window.registerTreeDataProvider('servers', serversData);
        vscode.commands.registerCommand('servers.addLocation', () => {
            serversData.addLocation();
        });
        vscode.commands.registerCommand('server.start', context => {
            connection.sendNotification(StartServerAsyncNotification.type, {
                params: {
                    serverType: context.type.id,
                    id: context.id,
                    attributes: new Map<string, any>()
                },
                mode: 'run'}
            );
        });
        vscode.commands.registerCommand('server.stop', context => {
            connection.sendNotification(StopServerAsyncNotification.type, {id: context.id, force: true});
        });
        vscode.commands.registerCommand('server.remove', context => {
            connection.sendNotification(DeleteServerNotification.type, {id: context.id, type: context.type});
        });
        vscode.commands.registerCommand('server.output', context => {
            serversData.showOutput(context);
        });

        context.subscriptions.push(connection);
    });
}

// this method is called when your extension is deactivated
export function deactivate() {
}
