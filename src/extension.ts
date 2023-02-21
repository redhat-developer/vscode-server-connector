/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RSPController } from 'vscode-server-connector-api';
import { OPTIONS } from './constants';
import { activateImpl, deactivateImpl } from './impl/extensionImpl';

// this method is called when your extension is activated
export async function activate(context: vscode.ExtensionContext): Promise<RSPController> {
    return activateImpl(context, OPTIONS);
}

// this method is called when your extension is deactivated
export async function deactivate(): Promise<void> {
    return deactivateImpl(OPTIONS);
}