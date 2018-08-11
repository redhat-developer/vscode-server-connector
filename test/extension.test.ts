
// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import * as vscode from 'vscode';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as vscode from 'vscode';
// import * as myExtension from '../extension';

// Defines a Mocha test suite to group tests of similar kind together
suite('Extension Tests', function() {
    let connection;
    suiteSetup(function(done) {
        setTimeout(function() {
            try {
                vscode.extensions.getExtension('redhat.vscode-adapters').exports.start.then(connInfo => {
                    connection = connInfo;
                    done();
                });
            } catch (e) {
                done(new Error(e));
            }
        }, 1000);
    });

    test('Server is started at extension activation time', function() {
        assert(connection !== undefined, 'Server has not started');
    });
});
