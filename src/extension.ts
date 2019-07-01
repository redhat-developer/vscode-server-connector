import * as vscode from 'vscode';
import * as serverConnectorAPI from 'vscode-server-connector-api';
import { ExtensionAPI } from './extensionApi';
import { RSPServer } from 'vscode-server-connector-api';
import { ServerAPI } from 'vscode-server-connector-api';
import { ServerState } from 'vscode-server-connector-api';
import { RSP_PROVIDER_NAME, RSP_PROVIDER_ID } from './constants';

export async function activate(context: vscode.ExtensionContext): Promise<ServerAPI>{

	const api: ExtensionAPI = new ExtensionAPI();

	const rsp: RSPServer = {
		state: ServerState.UNKNOWN,
		type: {
			id: RSP_PROVIDER_ID,
			visibilename: RSP_PROVIDER_NAME
		}
	};
	const serverConnector = await serverConnectorAPI.extension.RSPProvider.api;

	if (serverConnector.available) {		
		serverConnector.api.registerRSPProvider(rsp).catch((x: string) =>
			console.log('error' + x));
	}

	return api;
}

// this method is called when your extension is deactivated
export async function deactivate() {
	const serverConnector = await serverConnectorAPI.extension.RSPProvider.api;

	if (serverConnector.available) {		
		serverConnector.api.deregisterRSPProvider(RSP_PROVIDER_ID);
	}
}
