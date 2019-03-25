'use strict';
import * as vscode from 'vscode';

export class EditorUtil {
    constructor() {
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
}