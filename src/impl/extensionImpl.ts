/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { FelixRspController } from './controller';
import * as vscode from 'vscode';
import { API, retrieveUIExtension, RSPController, RSPServer, ServerState } from 'vscode-server-connector-api';
import { FelixRspLauncherOptions } from './server';

export async function activateImpl(context: vscode.ExtensionContext, 
    opts: FelixRspLauncherOptions): Promise<RSPController> {

    const api: FelixRspController = new FelixRspController(opts);
    const rsp: RSPServer = {
        state: ServerState.UNKNOWN,
        type: {
            id: opts.providerId,
            visibilename: opts.providerName
        }
    };

    const serverConnectorUI: API = await retrieveUIExtension();
    if (serverConnectorUI.available) {
        serverConnectorUI.api.registerRSPProvider(rsp);
    }

    return api;
}

export async function deactivateImpl(opts: FelixRspLauncherOptions): Promise<void> {
    const serverConnector = await retrieveUIExtension();
    if (serverConnector.available) {
        serverConnector.api.deregisterRSPProvider(opts.providerId);
    }
}
