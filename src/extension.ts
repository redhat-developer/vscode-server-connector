/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';
import { CommandHandler, ExtensionAPI } from './extensionApi';
import { JobProgress } from './jobprogress';
import { Protocol, RSPClient, ServerState } from 'rsp-client';
import * as server from './server';
import { ServersViewTreeDataProvider } from './serverExplorer';
import * as vscode from 'vscode';

let client: RSPClient;
let serversData: ServersViewTreeDataProvider;

const rspserverstdout = vscode.window.createOutputChannel('RSP Server (stdout)');
const rspserverstderr = vscode.window.createOutputChannel('RSP Server (stderr)');

const PROTOCOL_VERSION = '0.14.0';

export async function activate(context: vscode.ExtensionContext): Promise<ExtensionAPI> {
    const serverInfo = await server.start(onStdoutData, onStderrData);

    if (!serverInfo || !serverInfo.port) {
        return Promise.reject('Failed to start the rsp server');
    }
    client = await initClient(serverInfo);
    serversData = new ServersViewTreeDataProvider(client);
    vscode.window.registerTreeDataProvider('servers', serversData);
    const commandHandler = new CommandHandler(serversData, client);
    await commandHandler.activate();
    registerCommands(commandHandler, context);
    return { serverInfo };
}

async function initClient(serverInfo: server.ServerInfo): Promise<RSPClient> {
    const client = new RSPClient('localhost', serverInfo.port);
    await client.connect();

    client.getIncomingHandler().onPromptString(event => {
        return new Promise<string>((resolve, reject) => {
            vscode.window.showInputBox({ prompt: event.prompt, password: true })
                .then(value => {
                    if (value && value.trim().length) {
                        resolve(value);
                    } else {
                        reject(new Error('Cancelled by user'));
                    }
                });
        });
    });

    client.getOutgoingHandler().registerClientCapabilities(
        { map: { 'protocol.version': PROTOCOL_VERSION, 'prompt.string': 'true' } });
    JobProgress.create(client);

    return client;
}

function registerCommands(commandHandler: CommandHandler, context: vscode.ExtensionContext) {
    const newLocal = [
        vscode.commands.registerCommand('server.start',
            context => executeCommand(commandHandler.startServer, commandHandler, 'run', context)),
        vscode.commands.registerCommand('server.restart',
            context => executeCommand(commandHandler.restartServer, commandHandler, context)),
        vscode.commands.registerCommand('server.debug',
            context => executeCommand(commandHandler.debugServer, commandHandler, 'debug', context)),
        vscode.commands.registerCommand('server.stop',
            context => executeCommand(commandHandler.stopServer, commandHandler, context)),
        vscode.commands.registerCommand('server.remove',
            context => executeCommand(commandHandler.removeServer, commandHandler, context)),
        vscode.commands.registerCommand('server.output',
            context => executeCommand(commandHandler.showServerOutput, commandHandler, context)),
        vscode.commands.registerCommand('server.addDeployment',
            context => executeCommand(commandHandler.addDeployment, commandHandler, context)),
        vscode.commands.registerCommand('server.removeDeployment',
            context => executeCommand(commandHandler.removeDeployment, commandHandler, context)),
        vscode.commands.registerCommand('server.publishFull',
            context => executeCommand(commandHandler.fullPublishServer, commandHandler, context)),
        vscode.commands.registerCommand('server.createServer',
            () => executeCommand(commandHandler.createServer, commandHandler)),
        vscode.commands.registerCommand('server.addLocation',
            () => executeCommand(commandHandler.addLocation, commandHandler)),
        vscode.commands.registerCommand('server.downloadRuntime',
            () => executeCommand(commandHandler.downloadRuntime, commandHandler)),
        vscode.commands.registerCommand('server.infoServer',
            context => executeCommand(commandHandler.infoServer, commandHandler, context)),
        rspserverstdout,
        rspserverstderr
    ];
    const subscriptions = newLocal;
    subscriptions.forEach(element => {
        context.subscriptions.push(element);
    }, this);
}

export function deactivate() {
    if (client) {
        if (serversData) {
            for (const val of serversData.serverStatus.values()) {
                stopServer(val);
            }
        }
        client.shutdownServer();
    }
}

function stopServer(val: Protocol.ServerState) {
    const oneStat: Protocol.ServerState = val;
    const stateNum = oneStat.state;
    if (stateNum !== ServerState.UNKNOWN
      && stateNum !== ServerState.STOPPED
      && stateNum !== ServerState.STOPPING) {
        client.getOutgoingHandler().stopServerAsync({ id: oneStat.server.id, force: true });
    }
}

function onStdoutData(data: string) {
    displayLog(rspserverstdout, data.toString());
}

function onStderrData(data: string) {
    displayLog(rspserverstderr, data.toString());
}

function displayLog(outputPanel: vscode.OutputChannel, message: string, show: boolean = true) {
    if (show) outputPanel.show();
    outputPanel.appendLine(message);
}

function executeCommand(command: (...args: any[]) => Promise<any>, thisArg: any, ...params: any[]) {
    return command.call(thisArg, ...params).catch((err: string | Error) => {
        const error = typeof err === 'string' ? new Error(err) : err;
        vscode.window.showErrorMessage(error.message);
    });
}
