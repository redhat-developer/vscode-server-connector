/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';
import * as fs from 'fs';
import { Protocol } from 'rsp-client';
import { ServerExplorer } from './serverExplorer';
import * as tmp from 'tmp';
import { Utils } from './utils';
import * as vscode from 'vscode';

export class ServerEditorAdapter {

    private static instance: ServerEditorAdapter;
    private serverTmpFiles: Map<string, string> = new Map<string, string>();

    private constructor(private explorer: ServerExplorer) {
    }

    public static getInstance(explorer: ServerExplorer) {
        if (!ServerEditorAdapter.instance) {
            ServerEditorAdapter.instance = new ServerEditorAdapter(explorer);
        }
        return ServerEditorAdapter.instance;
    }

    public async showEditor(fileSuffix: string, content: string) {
        const newFile = vscode.Uri.parse('untitled:' + fileSuffix);
        await vscode.workspace.openTextDocument(newFile).then(async document => {
            const edit = new vscode.WorkspaceEdit();
            edit.insert(newFile, new vscode.Position(0, 0), content);
            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                vscode.window.showTextDocument(document);
            }
            else {
                vscode.window.showInformationMessage('Error Displaying Editor Content');
            }
        });
    }

    public async showServerJsonResponse(content: Protocol.GetServerJsonResponse): Promise<void> {
        if (!content || !content.serverHandle || !content.serverJson) {
            return Promise.reject('Could not handle server response: empty/invalid response');
        }

        if (this.serverTmpFiles.has(content.serverHandle.id)) {
            return this.saveAndShowEditor(
                this.serverTmpFiles.get(content.serverHandle.id),
                content.serverJson
            );
        } else {
            return tmp.file({ prefix: 'tmpServerConnectorProp', postfix: '.json' }, (err, path, fd) => {
                this.serverTmpFiles.set(content.serverHandle.id, path);
                this.saveAndShowEditor(path, content.serverJson);
            });
        }
    }

    private async saveAndShowEditor(path: string, content: string): Promise<void> {
        fs.writeFile(path, content, undefined, () => {
            return Promise.reject(`Unable to save file on path ${path}`);
        });

        vscode.workspace.openTextDocument(path).then(doc =>
            vscode.window.showTextDocument(doc)
        );
    }

    public async onDidSaveTextDocument(doc: vscode.TextDocument): Promise<Protocol.Status> {
        if (!doc) {
            return Promise.reject('Unable to save server properties');
        }
        if (await this.isTmpServerPropsFile(doc.fileName)) {
            const serverId = await Utils.getKeyByValue<string>(this.serverTmpFiles, doc.uri.path);
            if (!serverId) {
                return Promise.reject('Unable to save server properties - server id is invalid');
            }
            const serverHandle: Protocol.ServerHandle = this.explorer.serverStatus.get(serverId).server;
            if (!serverHandle) {
                return Promise.reject('Unable to save server properties - server is invalid');
            }
            return this.explorer.saveServerProperties(serverHandle, doc.getText());
        }
    }

    public async onDidCloseTextDocument(doc: vscode.TextDocument): Promise<void> {
        if (!doc) {
            return Promise.reject();
        }
        if (await this.isTmpServerPropsFile(doc.fileName)) {
            fs.unlink(doc.uri.fsPath, error => {
                console.log(error);
            });
        }
    }

    private isTmpServerPropsFile(docName: string): boolean {
        return docName.indexOf('tmpServerConnectorProp') > -1;
    }
}
