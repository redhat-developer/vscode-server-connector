'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ServersViewTreeDataProvider } from './serverExplorer';
//import { LanguageClient, LanguageClientOptions, RevealOutputChannelOn, StreamInfo} from 'vscode-languageclient';
import * as net from 'net';
import * as rpc from 'vscode-jsonrpc';
import { ServerAddedNotification } from './protocol';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "adapters-extension" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('extension.sayHello', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World!');
    });
    
    let connectionInfo = {
        port: 27511,
        host:"localhost"
    };

    let socket = net.connect(connectionInfo).on('connect', async () => {
        let connection = rpc.createMessageConnection(
            new rpc.StreamMessageReader(socket),
            new rpc.StreamMessageWriter(socket));
        
        connection.listen();
       
        connection.onNotification(ServerAddedNotification.type, handle => {
            serversData.refresh();
        });

        const serversData = new ServersViewTreeDataProvider(connection);
        vscode.window.registerTreeDataProvider('servers', serversData);
        vscode.commands.registerCommand('servers.addLocation', () => serversData.addLocation());

        context.subscriptions.push(connection);
    });

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}
