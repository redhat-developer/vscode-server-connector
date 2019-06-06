/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';
import * as fs from 'fs';
import { ServerExplorer } from './serverExplorer';
import * as vscode from 'vscode';

export class EditorUtil {

    private explorer: ServerExplorer;
    
    constructor(explorer: ServerExplorer) {
        this.explorer = explorer;
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

    public async _onDidSaveTextDocument(doc: vscode.TextDocument) {
        if (!doc) {
            return;
        }
        if (await EditorUtil.checkTmpServerPropsFile(doc)) {
           const contentSaved = doc.getText();
           this.explorer.editServer
           //send to server
        }
    }

    public async _onDidCloseTextDocument(doc: vscode.TextDocument) {
        if (!doc) {
            return;
        }
        if (await EditorUtil.checkTmpServerPropsFile(doc)) {
            fs.unlink(doc.uri.fsPath, (error) => {
                console.log(error);
            });
        }
    }

    private static async checkTmpServerPropsFile(doc: vscode.TextDocument): Promise<boolean> {
        if (doc.fileName.indexOf('tmpServerConnectorProp') > -1) {
            return true;
        }

        return false;
    }
}
