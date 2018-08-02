//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import * as vscode from 'vscode';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as vscode from 'vscode';
// import * as myExtension from '../extension';

// Defines a Mocha test suite to group tests of similar kind together
suite('Extension Tests', function() {
    let ssp;
    let client;
    suiteSetup(function() {
        ssp = vscode.extensions.getExtension('mohitsuman.adapters-vscode');
    });
    suite('Acivation Tests', function() {
        test('extension is activated', function() {
            assert.notEqual(ssp, undefined, 'SSP Extension is not loaded');
            assert.notEqual(ssp.exports, undefined, 'SSP Extension API is not exported');
        });
    });
    suite('ServersView TreeDataProvider Tests', function() {
        test('adds new server on ServerAdded event');
    });
});