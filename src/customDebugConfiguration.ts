import * as vscode from 'vscode';

const debugConfig: vscode.DebugConfiguration = {
    type: 'java',
    request: 'attach',
    name: 'Debug (Remote)',
    hostName: 'localhost',
    port: '8080'
};

export class CustomDebugConfiguration implements vscode.DebugConfigurationProvider {

    constructor(port: string, hostName?: string) {
        debugConfig.port = port;

        if (hostName !== undefined) {
            debugConfig.hostName = hostName;
        }
    }

    public provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration[]> {
        return [debugConfig];
    }

}
