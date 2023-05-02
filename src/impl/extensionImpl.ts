/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { FelixRspController } from './controller';
import * as vscode from 'vscode';
import { API, retrieveUIExtension, RSPController, RSPServer, ServerState } from 'vscode-server-connector-api';
import { FelixRspLauncherOptions } from './server';
import { IRecommendationService, RecommendationCore } from '@redhat-developer/vscode-extension-proposals/lib';
import { getTelemetryServiceInstance, initializeTelemetry } from './telemetry';

export const JAVA_DEBUG_EXTENSION: string = 'vscjava.vscode-java-debug';
export const JAVA_EXTENSION: string = 'redhat.java';

export async function activateImpl(context: vscode.ExtensionContext, 
    opts: FelixRspLauncherOptions): Promise<RSPController> {
    
    await initializeTelemetry(context);
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
    registerRecommendations(context);

    return api;
}

export async function deactivateImpl(opts: FelixRspLauncherOptions): Promise<void> {
    const serverConnector = await retrieveUIExtension();
    if (serverConnector.available) {
        serverConnector.api.deregisterRSPProvider(opts.providerId);
    }
}

async function registerRecommendations(context: vscode.ExtensionContext) {
    const telem = await getTelemetryServiceInstance();
    const recommendService: IRecommendationService | undefined = RecommendationCore.getService(context, telem);
    if( recommendService ) {
        const r1 = recommendService.create(JAVA_EXTENSION, "Language Support for Java", 
            "This extension is recommended for a better development environment experience when developing applications targeted to Java-based application servers .", true);
        const r2 = recommendService.create(JAVA_DEBUG_EXTENSION, "Debugger for Java", 
            "This extension is required to launch a server in debug mode and connect to it with a debugger.", true);
        recommendService.register([r1, r2]);
    }
}
