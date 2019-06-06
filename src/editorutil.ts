/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';
import * as fs from 'fs';
import { Protocol } from 'rsp-client';
import { ServerExplorer } from './serverExplorer';
import { Utils } from './utils';
import * as vscode from 'vscode';
const tmp = require('tmp');

export class EditorUtil {

    private static instance: EditorUtil;
    private explorer: ServerExplorer;
    private serverTmpFiles: Map<string, string> = new Map<string, string>();

    constructor(explorer: ServerExplorer) {
        this.explorer = explorer;
    }

    public static getInstance(explorer: ServerExplorer) {
        if (!EditorUtil.instance) {
            EditorUtil.instance = new EditorUtil(explorer);
        }
        return EditorUtil.instance;
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

    public async openServerJsonResponse(content: Protocol.GetServerJsonResponse): Promise<void> {
        if (!content || !content.serverHandle || !content.serverJson) {
            return;
        }

        if (this.serverTmpFiles.has(content.serverHandle.id)) {
            this.saveTmpJsonresponse(
                this.serverTmpFiles.get(content.serverHandle.id),
                content
            );
        } else {
            tmp.file({ prefix: 'tmpServerConnectorProp', postfix: '.json' }, (err, path, fd) => {
                this.serverTmpFiles.set(content.serverHandle.id, path);
                this.saveTmpJsonresponse(path, content);
            });
        }
    }

    private async saveTmpJsonresponse(path: string, content: Protocol.GetServerJsonResponse): Promise<void> {
        fs.writeFile(path, content.serverJson, undefined, () => {
            return Promise.reject();
        });

        vscode.workspace.openTextDocument(path).then(doc =>
            vscode.window.showTextDocument(doc)
        );
    }

    public async onDidSaveTextDocument(doc: vscode.TextDocument) {
        if (!doc) {
            return;
        }
        if (await this.checkTmpServerPropsFile(doc)) {
            const serverId = await Utils.getKeyByValue<string>(this.serverTmpFiles, doc.uri.path);
            if (!serverId) {
                //display error
            }
            const serverHandle: Protocol.ServerHandle = this.explorer.serverStatus.get(serverId).server;
            if (!serverHandle) {
                //display error
            }
            this.explorer.saveServerProperties(serverHandle, doc.getText());
        }
    }

    public async onDidCloseTextDocument(doc: vscode.TextDocument) {
        if (!doc) {
            return;
        }
        if (await this.checkTmpServerPropsFile(doc)) {
            fs.unlink(doc.uri.fsPath, (error) => {
                console.log(error);
            });
        }
    }

    private async checkTmpServerPropsFile(doc: vscode.TextDocument): Promise<boolean> {
        if (doc.fileName.indexOf('tmpServerConnectorProp') > -1) {
            return true;
        }

        return false;
    }
}
