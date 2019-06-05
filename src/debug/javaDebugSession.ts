/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Protocol, RSPClient } from 'rsp-client';
import * as vscode from 'vscode';

export class JavaDebugSession {

    private port: string;

    private processOutputListener: { port: string, server: Protocol.ServerHandle, listener: ((output: Protocol.ServerProcessOutput) => void)};

    constructor(private readonly client: RSPClient) {
    }

    public start(server: Protocol.ServerHandle, port: string) {
        this.processOutputListener = {
            port: port,
            server: server,
            listener: output => {
                if (output
                    && output.server
                    && output.server.id === server.id
                    && output.text
                    && output.text.includes('Listening for transport dt_socket')) {
                    this.startDebugger(port);
                    this.client.getIncomingHandler().removeOnServerProcessOutputAppended(this.processOutputListener.listener);
                }
            }
        };
        this.client.getIncomingHandler().onServerProcessOutputAppended(this.processOutputListener.listener);
    }

    private async startDebugger(port: string) {
        this.port = port;
        vscode.debug.startDebugging(undefined, {
            type: 'java',
            request: 'attach',
            name: 'Debug (Remote)',
            hostName: 'localhost',
            port: port
        });
    }

    public isDebuggerStarted(): boolean {
        return this.port !== undefined;
    }

    public async stop() {
        await vscode.commands.executeCommand('workbench.action.debug.stop');
        this.port = undefined;
    }
}
