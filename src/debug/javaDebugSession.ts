/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { DebugInfoProvider } from './debugInfoProvider';
import { Protocol, RSPClient } from 'rsp-client';
import * as vscode from 'vscode';

export class JavaDebugSession {

    constructor(private readonly client: RSPClient) {
    }

    public start(server: Protocol.ServerHandle, commandLine: Protocol.CommandLineDetails) {
        const listener = (output: Protocol.ServerProcessOutput) => {
            if (output.text.includes('Listening for transport dt_socket')) {
                this.startDebugger(commandLine);
                this.client.getIncomingHandler().removeOnServerProcessOutputAppended(listener);
            }
        };
        this.client.getIncomingHandler().onServerProcessOutputAppended(listener);
    }

    private async startDebugger(commandLine: Protocol.CommandLineDetails) {
        const port = DebugInfoProvider.create(commandLine).getPort();
        vscode.debug.startDebugging(undefined, {
            type: 'java',
            request: 'attach',
            name: 'Debug (Remote)',
            hostName: 'localhost',
            port: port
        });
    }

    public async stop(server: Protocol.ServerHandle) {
        await vscode.commands.executeCommand('workbench.action.debug.stop');
    }
}
