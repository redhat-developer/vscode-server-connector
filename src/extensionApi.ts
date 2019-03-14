import { ServerInfo } from './server';
import { ServersViewTreeDataProvider } from './serverExplorer';
import { EditorUtil } from './editorutil';
import * as vscode from 'vscode';
import { Protocol, RSPClient, ServerState, StatusSeverity } from 'rsp-client';
export interface ExtensionAPI {
    readonly serverInfo: ServerInfo;
}

export class CommandHandler {

    private client: RSPClient;
    private serversData: ServersViewTreeDataProvider;

    constructor(serversData: ServersViewTreeDataProvider, client: RSPClient) {
        this.client = client;
        this.serversData = serversData;
    }

    async startServer(mode: string, context?: Protocol.ServerState): Promise<Protocol.StartServerResponse> {
        let selectedServerType: Protocol.ServerType;
        let selectedServerId: string;

        if (context === undefined) {
            selectedServerId = await vscode.window.showQuickPick(Array.from(this.serversData.serverStatus.keys()),
                { placeHolder: 'Select runtime/server to start' });
            if (!selectedServerId) return null;
            selectedServerType = this.serversData.serverStatus.get(selectedServerId).server.type;
        } else {
            selectedServerType = context.server.type;
            selectedServerId = context.server.id;
        }

        const serverState = this.serversData.serverStatus.get(selectedServerId).state;
        if (serverState === ServerState.STOPPED || serverState === ServerState.UNKNOWN) {
            const response = await this.client.startServerAsync({
                params: {
                    serverType: selectedServerType.id,
                    id: selectedServerId,
                    attributes: new Map<string, any>()
                },
                mode: mode
            });
            if (!StatusSeverity.isOk(response.status)) {
                return Promise.reject(response.status.message);
            }
            return response;
        } else {
            return Promise.reject('The server is already running.');
        }
    }

    async stopServer(context?: Protocol.ServerState): Promise<Protocol.Status> {
        let serverId: string;
        if (context === undefined) {
            serverId = await vscode.window.showQuickPick(Array.from(this.serversData.serverStatus.keys()),
                { placeHolder: 'Select runtime/server to stop' });
            if (!serverId) return null;
        } else {
            serverId = context.server.id;
        }

        const stateObj: Protocol.ServerState = this.serversData.serverStatus.get(serverId);
        if (stateObj.state === ServerState.STARTED) {
            const status = await this.client.stopServerAsync({ id: serverId, force: true });
            if (!StatusSeverity.isOk(status)) {
                return Promise.reject(status.message);
            }
            return status;
        } else {
            return Promise.reject('The server is already stopped.');
        }
    }

    async removeServer(context?: Protocol.ServerState): Promise<Protocol.Status> {
        let serverId: string;
        let selectedServerType: Protocol.ServerType;
        if (context === undefined) {
            serverId = await vscode.window.showQuickPick(Array.from(this.serversData.serverStatus.keys()),
                { placeHolder: 'Select runtime/server to remove' });
            if (!serverId) return null;
            selectedServerType = this.serversData.serverStatus.get(serverId).server.type;
        } else {
            serverId = context.server.id;
            selectedServerType = context.server.type;
        }

        const status1: Protocol.ServerState = this.serversData.serverStatus.get(serverId);
        if (status1.state === ServerState.STOPPED) {
            const status = await this.client.deleteServerAsync({ id: serverId, type: selectedServerType });
            if (!StatusSeverity.isOk(status)) {
                return Promise.reject(status.message);
            }
            return status;
        } else {
            return Promise.reject('Please stop the server before removing it.');
        }
    }

    async showServerOutput(context?: Protocol.ServerState): Promise<void> {
        if (context === undefined) {
            const serverId = await vscode.window.showQuickPick(Array.from(this.serversData.serverStatus.keys()),
                { placeHolder: 'Select runtime/server to show output channel' });
            if (!serverId) return null;
            context = this.serversData.serverStatus.get(serverId);
        }
        this.serversData.showOutput(context);
    }

    async restartServer(context?: Protocol.ServerState): Promise<void> {
        if (context === undefined) {
            const serverId: string = await vscode.window.showQuickPick(
                Array
                  .from(this.serversData.serverStatus.keys())
                  .filter(item => this.serversData.serverStatus.get(item).state === ServerState.STARTED),
                    { placeHolder: 'Select runtime/server to restart' }
            );
            if (!serverId) return null;
            context = this.serversData.serverStatus.get(serverId);
        }

        const params: Protocol.LaunchParameters = {
            mode: 'run',
            params: {
                id: context.server.id,
                serverType: context.server.type.id,
                attributes: new Map<string, any>()
            }
        };

        await this.client.stopServerSync({ id: context.server.id, force: true });
        await this.client.startServerAsync(params);
    }

    async addDeployment(context?: Protocol.ServerState): Promise<Protocol.Status> {
        let serverId: string;
        if (context === undefined) {
            return Promise.reject('Please select a server from the Servers view.');
        } else {
            serverId = context.server.id;
        }

        if (this.serversData) {
            const serverHandle: Protocol.ServerHandle = this.serversData.serverStatus.get(serverId).server;
            return this.serversData.addDeployment(serverHandle);
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    async removeDeployment(context?: Protocol.DeployableState): Promise<Protocol.Status> {
        if (context === undefined) {
            return Promise.reject('Please select a deployment from the Servers view to run this action.');
        }

        const serverId: string = context.server.id;
        const deploymentId: string = context.reference.label;

        if (this.serversData) {
            const serverState: Protocol.ServerState = this.serversData.serverStatus.get(serverId);
            if (serverState === undefined) {
                return Promise.reject('Please select a deployment from the Servers view to run this action.');
            }
            const serverHandle: Protocol.ServerHandle = serverState.server;
            const states: Protocol.DeployableState[] = serverState.deployableStates;
            for (const entry of states) {
                if ( entry.reference.label === deploymentId) {
                    return this.serversData.removeDeployment(serverHandle, entry.reference);
                }
            }
            return Promise.reject('Cannot find deployment ' + deploymentId);
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    async fullPublishServer(context?: Protocol.ServerState): Promise<Protocol.Status> {
        let serverId: string;
        if (context === undefined) {
            return Promise.reject('Please select a server from the Servers view.');
        } else {
            serverId = context.server.id;
        }

        if (this.serversData) {
            const serverHandle: Protocol.ServerHandle = this.serversData.serverStatus.get(serverId).server;
            return this.serversData.publish(serverHandle, 2); // TODO use constant? Where is it?
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    async createServer(): Promise<Protocol.Status> {
        this.assertServersDataExists();
        const download: string = await vscode.window.showQuickPick(['Yes, please download', 'No, use runtime on my disk'],
            { placeHolder: 'Do you want to download a runtime?', ignoreFocusOut: true });
        if (download.startsWith('Yes')) {
            return this.downloadRuntime();
        } else if (download.startsWith('No')) {
            return this.addLocation();
        }
    }

    private assertServersDataExists() {
      if (!this.serversData) {
        throw new Error('Runtime Server Protocol (RSP) Server is starting, please try again later.');
      }
    }

    async addLocation(): Promise<Protocol.Status> {
        if (this.serversData) {
            return this.serversData.addLocation();
        } else {
            return Promise.reject('Runtime Server Protocol (RSP) Server is starting, please try again later.');
        }
    }

    async downloadRuntime(): Promise<Protocol.Status> {
        const rtId: string = await this.promptDownloadableRuntimes();
        if (!rtId) {
            return Promise.reject('Canceled by user');
        }
        let response1: Protocol.WorkflowResponse = await this.initEmptyDownloadRuntimeRequest(rtId);
        while (true) {
            if (StatusSeverity.isOk(response1.status)) {
                vscode.window.showInformationMessage('Your download has begun.');
                return Promise.resolve(response1.status);
            } else if (StatusSeverity.isError(response1.status)
                        || StatusSeverity.isCancel(response1.status)) {
                // error
                return Promise.reject(response1.status);
            }

            // not complete, not an error.
            const workflowMap = {};
            for (const item of response1.items ) {
                if (this.isMultilineText(item.content) ) {
                    await new EditorUtil().showEditor(item.id, item.content);
                }

                const canceled: boolean = await this.promptUser(item, workflowMap);
                if (canceled) {
                  return Promise.reject('Canceled by user');
                }
            }
            // Now we have a data map
            response1 = await this.initDownloadRuntimeRequest(rtId, workflowMap, response1.requestId);
        }
    }

    private async promptUser(item: Protocol.WorkflowResponseItem, workflowMap: {}): Promise<boolean> {
        const prompt = item.label + (item.content ? `\n${item.content}` : '');
        let userInput: any = null;
        if (item.responseType === 'none') {
            userInput = await vscode.window.showQuickPick(['continue...'], { placeHolder: prompt, ignoreFocusOut: true });
        } else {
            if (item.responseType === 'bool') {
                const oneProp = await vscode.window.showQuickPick(['true', 'false'], { placeHolder: prompt, ignoreFocusOut: true });
                userInput = (oneProp === 'true');
            } else {
                const oneProp = await vscode.window.showInputBox({ prompt: prompt, ignoreFocusOut: true });
                if (item.responseType === 'int') {
                    userInput = +oneProp;
                } else {
                    userInput = oneProp;
                }
            }
        }

        workflowMap[item.id] = userInput;
        return userInput === undefined;
    }

    private isMultilineText(content: string) {
      return content && content.indexOf('\n') !== -1;
    }

    async initDownloadRuntimeRequest(id: string, data1: {[index: string]: any}, reqId: number): Promise<Protocol.WorkflowResponse> {
      const req: Protocol.DownloadSingleRuntimeRequest = {
        requestId: reqId,
        downloadRuntimeId: id,
        data: data1
      };
      const resp: Promise<Protocol.WorkflowResponse> = this.client.downloadRuntime(req, 20000);
      return resp;
    }

    async initEmptyDownloadRuntimeRequest(id: string): Promise<Protocol.WorkflowResponse> {
      const req: Protocol.DownloadSingleRuntimeRequest = {
        requestId: null,
        downloadRuntimeId: id,
        data: {}
      };
      const resp: Promise<Protocol.WorkflowResponse> = this.client.downloadRuntime(req);
      return resp;
    }

    async promptDownloadableRuntimes(): Promise<string> {
        const newlist = this.client.listDownloadRuntimes(5000)
          .then(async (list: Protocol.ListDownloadRuntimeResponse) => {
            const rts: Protocol.DownloadRuntimeDescription[] = list.runtimes;
            const newlist: any[] = [];
            for (const rt of rts) {
                newlist.push({ label: rt.name, id: rt.id });
            }
            return newlist;
        });
        const answer = await vscode.window.showQuickPick(newlist, { placeHolder: 'Please choose a runtime to download.' });
        console.log(`${answer} was chosen`);
        if (!answer) {
          return null;
        } else {
          return answer.id;
        }
    }

    async activate(): Promise<void> {
        this.client.onServerAdded(handle => {
            this.serversData.insertServer(handle);
        });

        this.client.onServerRemoved(handle => {
            this.serversData.removeServer(handle);
        });

        this.client.onServerStateChange(event => {
            this.serversData.updateServer(event);
        });

        this.client.onServerOutputAppended(event => {
            this.serversData.addServerOutput(event);
        });
    }
}
