import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Tests', function() {
    let connection;
    suiteSetup(async () => {
        connection = await vscode.extensions.getExtension('redhat.vscode-adapters').activate();
    });

    test('Server is started at extension activation time', function() {
        assert(connection !== undefined, 'Server has not started');
    });
});
