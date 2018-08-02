import { TreeDataProvider } from 'vscode';
import { Protocol } from 'ssp-client';

export interface ExtensionAPI {
    readonly apiVersion: string;
    readonly server: IServer;
    readonly treeDataProvider: TreeDataProvider<Protocol.ServerHandle>;
}

export interface IServer {
    on(status: string, callback: Function);
}