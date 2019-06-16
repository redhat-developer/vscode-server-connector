/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';
import { CommandHandler, ExtensionAPI } from './extensionApi';
import { JobProgress } from './jobprogress';
import { Protocol, RSPClient, ServerState } from 'rsp-client';
import { RSPProvider } from './rspProvider';
import * as server from './server';
import { ServerEditorAdapter } from './serverEditorAdapter';
import { ServerExplorer as ServersExplorer, RSPProviderUtils, RSPState } from './serverExplorer';
import * as vscode from 'vscode';

const rspProviders: Map<RSPProvider, RSPState> = new Map<RSPProvider, RSPState>(); //to be modified, id as key when we will use external providers
let client: RSPClient;
let serversExplorer: ServersExplorer;
let commandHandler: CommandHandler;

const rspserverstdout = vscode.window.createOutputChannel('RSP Server (stdout)');
const rspserverstderr = vscode.window.createOutputChannel('RSP Server (stderr)');

const PROTOCOL_VERSION = '0.14.0';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    registerRSPProvider(); // to be removed when external extensions will register themselves automatically
    serversExplorer = new ServersExplorer();
    commandHandler = new CommandHandler(serversExplorer);
    
    Array.from(rspProviders.keys()).forEach(rsp => {
        // const rspserverstdout = vscode.window.createOutputChannel('RSP Server (stdout)');
        // const rspserverstderr = vscode.window.createOutputChannel('RSP Server (stderr)');

        const rspUtils: RSPProviderUtils = {
            state: rspProviders.get(rsp),
            client: undefined,
            rspserverstderr: rspserverstderr,
            rspserverstdout: rspserverstdout
        };
        serversExplorer.rspProvidersM.set(rsp.getId(), rspUtils);
    });

    await startRSPServers();

    serversExplorer.initTreeRsp();


    registerCommands(commandHandler, context);

    
    
    //const serverInfo = await server.start(onStdoutData, onStderrData);

    // if (!serverInfo || !serverInfo.port) {
    //     return Promise.reject('Failed to start the rsp server');
    // }
    // client = await initClient(serverInfo);
    // serversExplorer = new ServersExplorer(client);
    // const commandHandler = new CommandHandler(serversExplorer, client);
    // await commandHandler.activate();
    // registerCommands(commandHandler, context);
    // return { serverInfo };
}

async function startRSPServers(): Promise<void> {
    Array.from(rspProviders.keys()).forEach(async rsp => {
        const serverInfo = await rsp.startRSP(onStdoutData, onStderrData); //to modify state rsp server inside RSPState
        const nameRSP = rsp.getName();

        if (!serverInfo || !serverInfo.port) {
            return Promise.reject(`Failed to start the ${nameRSP} rsp server`);
        }

        client = await initClient(serverInfo);

        const rspUtils: RSPProviderUtils = serversExplorer.rspProvidersM.get(rsp.getId());
        rspUtils.client = client;
        rspUtils.state.serverStates = [];
        serversExplorer.rspProvidersM.set(rsp.getId(), rspUtils);
        await commandHandler.activate(rsp.getId(), client);

    });

}

function registerRSPProvider() {
    const rspProv: RSPProvider = new RSPProvider();
    rspProviders.set(rspProv, rspProv.getState());
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
    const errorMessage = 'Unable to %ACTION% the server: ';
    const newLocal = [
        vscode.commands.registerCommand('server.start',
            context => executeCommand(commandHandler.startServer, commandHandler, 'run', context, errorMessage.replace('%ACTION%', 'start'))),
        vscode.commands.registerCommand('server.restart',
            context => executeCommand(commandHandler.restartServer, commandHandler, 'run', context, errorMessage.replace('%ACTION%', 'restart in run mode'))),
        vscode.commands.registerCommand('server.debug',
            context => executeCommand(commandHandler.debugServer, commandHandler, context, errorMessage.replace('%ACTION%', 'debug'))),
        vscode.commands.registerCommand('server.restartDebug',
            context => executeCommand(commandHandler.restartServer, commandHandler, 'debug', context, errorMessage.replace('%ACTION%', 'restart in debug mode'))),
        vscode.commands.registerCommand('server.stop',
            context => executeCommand(commandHandler.stopServer, commandHandler, false, context, errorMessage.replace('%ACTION%', 'stop'))),
        vscode.commands.registerCommand('server.terminate',
            context => executeCommand(commandHandler.stopServer, commandHandler, true, context, errorMessage.replace('%ACTION%', 'terminate'))),
        vscode.commands.registerCommand('server.remove',
            context => executeCommand(commandHandler.removeServer, commandHandler, context, errorMessage.replace('%ACTION%', 'remove'))),
        vscode.commands.registerCommand('server.output',
            context => executeCommand(commandHandler.showServerOutput, commandHandler, context, 'Unable to show server output channel')),
        vscode.commands.registerCommand('server.addDeployment',
            context => executeCommand(commandHandler.addDeployment, commandHandler, context, errorMessage.replace('%ACTION%', 'add deployment to'))),
        vscode.commands.registerCommand('server.removeDeployment',
            context => executeCommand(commandHandler.removeDeployment, commandHandler, context, errorMessage.replace('%ACTION%', 'remove deployment to'))),
        vscode.commands.registerCommand('server.publishFull',
            context => executeCommand(commandHandler.fullPublishServer, commandHandler, context, errorMessage.replace('%ACTION%', 'publish to'))),
        vscode.commands.registerCommand('server.createServer',
            () => executeCommand(commandHandler.createServer, commandHandler, errorMessage.replace('%ACTION%', 'create'))),
        vscode.commands.registerCommand('server.addLocation',
            () => executeCommand(commandHandler.addLocation, commandHandler, 'Unable to detect any server: ')),
        vscode.commands.registerCommand('server.downloadRuntime',
            () => executeCommand(commandHandler.downloadRuntime, commandHandler, 'Unable to detect any runtime: ')),
        vscode.commands.registerCommand('server.editServer',
            context => executeCommand(commandHandler.editServer, commandHandler, context, 'Unable to edit server properties')),
        vscode.commands.registerCommand('server.infoServer',
            context => executeCommand(commandHandler.infoServer, commandHandler, context, 'Unable to retrieve server properties')),
        vscode.workspace.onDidSaveTextDocument(onDidSaveTextDocument),
        vscode.workspace.onDidCloseTextDocument(onDidCloseTextDocument)
    ];
    const subscriptions = newLocal;
    subscriptions.forEach(element => {
        context.subscriptions.push(element);
    }, this);
}

export function deactivate() {
    if (client) {
        if (serversExplorer) {
            for (const val of serversExplorer.serverStatus.values()) {
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
    //const rspserverstdout = serversExplorer.getRSPOutputChannel(server);
    displayLog(rspserverstdout, data.toString());
}

function onStderrData(data: string) {
    //const rspserverstderr = serversExplorer.getRSPErrorChannel(server);
    displayLog(rspserverstderr, data.toString());
}

function displayLog(outputPanel: vscode.OutputChannel, message: string, show: boolean = true) {
    if (show) outputPanel.show();
    outputPanel.appendLine(message);
}

function onDidSaveTextDocument(doc: vscode.TextDocument) {
    ServerEditorAdapter.getInstance(serversExplorer).onDidSaveTextDocument(doc).catch(err => {
        vscode.window.showErrorMessage(err);
    });
}

function onDidCloseTextDocument(doc: vscode.TextDocument) {
    ServerEditorAdapter.getInstance(serversExplorer).onDidCloseTextDocument(doc);
}

function executeCommand(command: (...args: any[]) => Promise<any>, thisArg: any, ...params: any[]) {
    const commandErrorLabel = typeof params[params.length - 1] === 'string' ? params[params.length - 1] : '';
    return command.call(thisArg, ...params).catch((err: string | Error) => {
        const error = typeof err === 'string' ? new Error(err) : err;
        const msg = error.hasOwnProperty('message') ? error.message : '';
        if (commandErrorLabel === '' && msg === '') {
            return;
        }
        vscode.window.showErrorMessage(`${commandErrorLabel} Extension backend error - ${msg.toLowerCase()}`);
    });
}
