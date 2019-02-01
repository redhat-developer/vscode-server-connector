'use strict';
import * as vscode from 'vscode';
import { ServersViewTreeDataProvider } from './serverExplorer';
import * as server from './server';
import { RSPClient, Protocol, ServerState } from 'rsp-client';
import { ExtensionAPI, CommandHandler } from './extensionApi';

let client: RSPClient;
let serversData: ServersViewTreeDataProvider;

const rspserverstdout = vscode.window.createOutputChannel('RSP Server (stdout)');
const rspserverstderr = vscode.window.createOutputChannel('RSP Server (stderr)');

export async function activate(context: vscode.ExtensionContext): Promise<ExtensionAPI> {
    let commandHandler: CommandHandler;

    const serverInfo = await server.start(onStdoutData, onStderrData);
    client = new RSPClient('localhost', serverInfo.port);
    await client.connect();

    serversData = new ServersViewTreeDataProvider(client);
    vscode.window.registerTreeDataProvider('servers', serversData);
    commandHandler = new CommandHandler(serversData, client);
    await commandHandler.activate();
    const subscriptions = [
        vscode.commands.registerCommand('server.start', context => executeCommand(commandHandler.startServer, commandHandler, 'run', context)),
        vscode.commands.registerCommand('server.debug', context => executeCommand(commandHandler.startServer, commandHandler, 'debug', context)),
        vscode.commands.registerCommand('server.stop', context => executeCommand(commandHandler.stopServer, commandHandler, context)),
        vscode.commands.registerCommand('server.remove', context => executeCommand(commandHandler.removeServer, commandHandler, context)),
        vscode.commands.registerCommand('server.output', context => executeCommand(commandHandler.showServerOutput, commandHandler, context)),
        vscode.commands.registerCommand('servers.addLocation', () => executeCommand(commandHandler.addLocation, commandHandler)),
        vscode.commands.registerCommand('server.restart', context => executeCommand(commandHandler.restartServer, commandHandler, context)),

        vscode.commands.registerCommand('server.addDeployment', context => executeCommand(commandHandler.addDeployment, commandHandler, context)),
        vscode.commands.registerCommand('server.removeDeployment', context => executeCommand(commandHandler.removeDeployment, commandHandler, context)),
        vscode.commands.registerCommand('server.publishFull', context => executeCommand(commandHandler.fullPublishServer, commandHandler, context)),

        rspserverstdout,
        rspserverstderr
    ];
    subscriptions.forEach(element => {
        context.subscriptions.push(element);
    }, this);
    return { serverInfo };
}

export function deactivate() {
    if (client) {
        if( serversData) {
            const statIterator: Protocol.ServerState = serversData.serverStatus.values();
            while(statIterator.hasNext()) {
                const oneStat: Protocol.ServerState = statIterator.next();
                const stateNum = oneStat.state;
                if(stateNum !== ServerState.UNKNOWN && stateNum !== ServerState.STOPPED && stateNum !== ServerState.STOPPING) {
                    client.stopServerAsync( {id: oneStat.server.id, force: true });
                }
            }
        }
        client.shutdownServer();
    }
}

function onStdoutData(data: string) {
    displayLog(rspserverstdout, data.toString());
}

function onStderrData(data: string) {
    displayLog(rspserverstderr, data.toString());
};

function displayLog(outputPanel: vscode.OutputChannel, message: string, show: boolean = true) {
    if (show) outputPanel.show();
    outputPanel.appendLine(message);
}

function executeCommand(command: (...args: any[]) => Promise<any>, thisArg: any, ...params: any[]) {
    return command.call(thisArg, ...params).catch(err => {
        vscode.window.showErrorMessage(err);
    });
}