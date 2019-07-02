/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { RSP_PROVIDER_NAME } from './constants';
import { EventEmitter } from 'events';
import * as server from './server';
import { ServerAPI, ServerInfo, ServerState } from 'vscode-server-connector-api';

export class ExtensionAPI implements ServerAPI {

    private host: string;
    private port: number;
    private emitter: EventEmitter;

    public constructor() {
        this.host = '';
        this.port = 0;
        this.emitter = new EventEmitter();
    }

    public async startRSP(stdoutCallback: (data: string) => void, stderrCallback: (data: string) => void ): Promise<ServerInfo>  {
        this.updateRSPStateChanged(ServerState.STARTING);
        return await server.start(stdoutCallback, stderrCallback).then(serverInfo => {
            this.host = serverInfo.host;
            this.port = serverInfo.port;
            this.updateRSPStateChanged(ServerState.STARTED);
            return serverInfo;
        }).catch((error) => {
            this.updateRSPStateChanged(ServerState.STOPPED);
            return Promise.reject(`RSP Error - ${RSP_PROVIDER_NAME} failed to start - ${error ? error : ''}`);
        });
    }

    public async stopRSP(): Promise<void> {
        server.terminate().catch(err => { 
            return err;
        });
    }

    public onRSPServerStateChanged(listener: (state: number) => void): void {
        this.emitter.on('rspServerStateChanged', listener);
    }

    private async updateRSPStateChanged(state: number): Promise<void> {
        this.emitter.emit('rspServerStateChanged', state);
    }

    public getHost(): string {
        return this.host;
    }

    public getPort(): number {
        return this.port;
    }
}
