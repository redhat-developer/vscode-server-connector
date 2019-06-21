/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';
import { CommandHandler, ExtensionAPI } from './extensionApi';
import { JobProgress } from './jobprogress';
import { RSPClient, ServerState } from 'rsp-client';
import { RSPProvider } from './rspProvider';
import * as server from './server';
import { ServerEditorAdapter } from './serverEditorAdapter';
import { RSPProperties, RSPState, ServerExplorer as ServersExplorer, ServerStateNode } from './serverExplorer';
import * as vscode from 'vscode';
//import { apiBroker } from './api/implementation/apiBroker';

const rspProviders: Map<RSPProvider, RSPState> = new Map<RSPProvider, RSPState>(); //to be modified, id as key when we will use external providers
let client: RSPClient;
let serversExplorer: ServersExplorer;
let commandHandler: CommandHandler;

const PROTOCOL_VERSION = '0.14.0';

export async function activate(context: vscode.ExtensionContext): Promise<ExtensionAPI> {
    //registerRSPProvider(); // TEST - to be removed when external extensions will register themselves automatically
    // serversExplorer = ServersExplorer.getInstance();
    // commandHandler = new CommandHandler(serversExplorer);

    if ( false ) {
        startRSPServers();
        registerCommands(commandHandler, context);
    }

    // Array.from(rspProviders.keys()).forEach(rsp => { // TEST - to be modified when external extensions will register themselves automatically
    //     const rspserverstdout = vscode.window.createOutputChannel(`${rsp.getName()} (stdout)`);
    //     const rspserverstderr = vscode.window.createOutputChannel(`${rsp.getName()} (stderr)`);

    //     const rspUtils: RSPProperties = {
    //         state: rspProviders.get(rsp),
    //         client: undefined,
    //         rspserverstderr: rspserverstderr,
    //         rspserverstdout: rspserverstdout
    //     };
    //     serversExplorer.RSPServersStatus.set(rsp.getId(), rspUtils);
    // });

    //await startRSPServers(); // TEST - to be modified when external extensions will register themselves automatically
    //serversExplorer.initTreeRsp(); // TEST - to be modified when external extensions will register themselves automatically
    // registerCommands(commandHandler, context);

    // let api = {
    //     sum(a, b) {
    //         return a + b;
    //     },
    //     mul(a, b) {
    //         return a * b;
    //     }
    // };
    // 'export' public api-surface
    //const apiB = apiBroker();
    return { version: 1 };

}

async function startRSPServers(): Promise<void> { // TEST - to be modified when external extensions will register themselves automatically
    for (const rsp of rspProviders.keys()) {
        const serverInfo = await rsp.startRSP(
        (data: string) => {
            const rspserverstdout = serversExplorer.getRSPOutputChannel(rsp.getId());
            displayLog(rspserverstdout, data.toString());
        }, (data: string) => {
            const rspserverstderr = serversExplorer.getRSPErrorChannel(rsp.getId());
            displayLog(rspserverstderr, data.toString());
        });

        const nameRSP = rsp.getName();

        if (!serverInfo || !serverInfo.port) {
            return Promise.reject(`Failed to start the ${nameRSP} rsp server`);
        }

        client = await initClient(serverInfo);

        const rspUtils: RSPProperties = serversExplorer.RSPServersStatus.get(rsp.getId());
        rspUtils.client = client;
        rspUtils.state.serverStates = [];
        serversExplorer.RSPServersStatus.set(rsp.getId(), rspUtils);
        await commandHandler.activate(rsp.getId(), client);
    }

}

// function registerRSPProvider() {
//     const rspProv: RSPProvider = new RSPProvider();
//     rspProviders.set(rspProv, rspProv.getState());
// }

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
            () => executeCommand(commandHandler.createServer, commandHandler, undefined, errorMessage.replace('%ACTION%', 'create'))),
        vscode.commands.registerCommand('server.addLocation',
            () => executeCommand(commandHandler.addLocation, commandHandler, undefined, 'Unable to detect any server: ')),
        vscode.commands.registerCommand('server.downloadRuntime',
            () => executeCommand(commandHandler.downloadRuntime, commandHandler, undefined, 'Unable to detect any runtime: ')),
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

// export async function registerRSPProvider(rsp: RSPState): Promise<void> {
//     let error: string;
//     if (!rsp) {
//         error = 'Unable to register RSP provider - RSP state is not valid.';
//         vscode.window.showErrorMessage(error);
//         return Promise.reject(error);
//     }

//     if (!rsp.type || !rsp.type.id) {
//         error = 'Unable to register RSP provider - Id is not valid.';
//         vscode.window.showErrorMessage(error);
//         return Promise.reject(error);
//     }

//     const rspserverstdout = vscode.window.createOutputChannel(`${rsp.type.visibilename} (stdout)`);
//     const rspserverstderr = vscode.window.createOutputChannel(`${rsp.type.visibilename} (stderr)`);

//     const rspProperties: RSPProperties = {
//         state: rsp,
//         client: undefined,
//         rspserverstderr: rspserverstderr,
//         rspserverstdout: rspserverstdout
//     };
//     serversExplorer.RSPServersStatus.set(rsp.type.id, rspProperties);
//     serversExplorer.initTreeRsp();
// }

// export async function deregisterRSPProvider(id: string): Promise<void> {
//     if (!id) {
//         const error = 'Unable to remove RSP provider - Id is not valid.';
//         vscode.window.showErrorMessage(error);
//         return Promise.reject(error);
//     }

//     serversExplorer.RSPServersStatus.get(id).rspserverstdout.dispose();
//     serversExplorer.RSPServersStatus.get(id).rspserverstderr.dispose();
//     serversExplorer.RSPServersStatus.delete(id);
// }

export function deactivate() {
    for (const rspProvider of serversExplorer.RSPServersStatus.values()) {
        if (rspProvider.client) {
            for (const server of rspProvider.state.serverStates) {
                stopServer(server);
            }
            rspProvider.client.shutdownServer();
        }
    }
}

function stopServer(val: ServerStateNode) {
    const oneStat: ServerStateNode = val;
    const stateNum = oneStat.state;
    if (stateNum !== ServerState.UNKNOWN
      && stateNum !== ServerState.STOPPED
      && stateNum !== ServerState.STOPPING) {
        client.getOutgoingHandler().stopServerAsync({ id: oneStat.server.id, force: true });
    }
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
