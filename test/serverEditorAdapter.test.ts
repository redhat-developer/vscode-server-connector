/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as chai from 'chai';
import * as chaipromise from 'chai-as-promised';
import { ClientStubs } from './clientstubs';
import * as fs from 'fs';
import { ProtocolStubs } from './protocolstubs';
import { Protocol } from 'rsp-client';
import { ServerEditorAdapter } from '../src/serverEditorAdapter';
import { ServerExplorer } from '../src/serverExplorer';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { Utils } from '../src/utils';
import { EndOfLine, TextDocument, Uri } from 'vscode';

const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaipromise);

suite('ServerEditorAdapter', () => {
    let sandbox: sinon.SinonSandbox;
    let serverEditorAdapter: ServerEditorAdapter;
    let stubs: ClientStubs;
    let serverExplorer: ServerExplorer;
    const uriDoc: Uri = {
        scheme: undefined,
        authority: undefined,
        fragment: undefined,
        fsPath: '/fakepath/',
        path: '/fakepath/',
        query: undefined,
        with: undefined,
        toJSON: undefined,
        toString: undefined
    };

    const textDocument: TextDocument = {
        uri: undefined,
        fileName: 'tmpServerConnector-server.json',
        isClosed: false,
        isDirty: false,
        isUntitled: false,
        languageId: '',
        version: 1,
        eol: EndOfLine.CRLF,
        save: undefined,
        lineCount: 33,
        lineAt: undefined,
        getText: () => '',
        getWordRangeAtPosition: undefined,
        offsetAt: undefined,
        positionAt: undefined,
        validatePosition: undefined,
        validateRange: undefined
    };

    const {uri, ...rest} = textDocument;
    const textDocumentWithUri: TextDocument = {
        uri: uriDoc,
        ...rest
    };

    const {fileName, ...restWUri} = textDocumentWithUri;
    const textDocumentWithoutTmpName: TextDocument = {
        fileName: 'file.json',
        ...restWUri
    };

    setup(() => {
        sandbox = sinon.createSandbox();

        stubs = new ClientStubs(sandbox);
        stubs.outgoing.getServerHandles = sandbox.stub().resolves([ProtocolStubs.serverHandle]);
        stubs.outgoing.getServerState = sandbox.stub().resolves(ProtocolStubs.unknownServerState);

        serverExplorer = new ServerExplorer(stubs.client);

        serverExplorer.serverStatus.set('server', ProtocolStubs.unknownServerState);

        serverEditorAdapter = ServerEditorAdapter.getInstance(serverExplorer);
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('showServerJsonResponse', () => {

        test('Error if server json Response is Empty', async () => {
            try {
                await serverEditorAdapter.showServerJsonResponse(undefined);
                expect.fail();
            } catch (err) {
                expect(err).equals('Could not handle server response: empty/invalid response');
            }
        });

        test('Error if serverHandle property of server json Response is Empty', async () => {
            const serverJsonResponse: Protocol.GetServerJsonResponse = {
                serverHandle: undefined,
                serverJson: '',
                status: ProtocolStubs.okStatus
            };

            try {
                await serverEditorAdapter.showServerJsonResponse(serverJsonResponse);
                expect.fail();
            } catch (err) {
                expect(err).equals('Could not handle server response: empty/invalid response');
            }
        });

        test('Error if serverJson property of server json Response is Empty', async () => {
            const serverJsonResponse: Protocol.GetServerJsonResponse = {
                serverHandle: ProtocolStubs.serverHandle,
                serverJson: undefined,
                status: ProtocolStubs.okStatus
            };

            try {
                await serverEditorAdapter.showServerJsonResponse(serverJsonResponse);
                expect.fail();
            } catch (err) {
                expect(err).equals('Could not handle server response: empty/invalid response');
            }
        });
    });

    suite('onDidSaveTextDocument', () => {

        test('Error savings temp file if doc is undefined', async () => {

            try {
                await serverEditorAdapter.onDidSaveTextDocument(undefined);
                expect.fail();
            } catch (err) {
                expect(err).equals('Unable to save server properties');
            }

        });

        test('Error savings temp file if doc Uri is undefined', async () => {

            try {
                await serverEditorAdapter.onDidSaveTextDocument(textDocument);
                expect.fail();
            } catch (err) {
                expect(err).equals('Unable to save server properties - Uri is invalid');
            }

        });

        test('Error savings temp file if server id is undefined', async () => {

            sandbox.stub(Utils, 'getKeyByValueString').resolves(undefined);

            try {
                await serverEditorAdapter.onDidSaveTextDocument(textDocumentWithUri);
                expect.fail();
            } catch (err) {
                expect(err).equals('Unable to save server properties - server id is invalid');
            }

        });

    });

    suite('saveServerproperties', () => {

        test('Error updating server if serverhandle is empty', async () => {

            try {
                await serverExplorer.saveServerProperties(undefined, 'text');
                expect.fail();
            } catch (err) {
                expect(err).equals('Unable to update server properties - Invalid server');
            }

        });

        test('Error updating server if content is empty', async () => {

            try {
                await serverExplorer.saveServerProperties(ProtocolStubs.serverHandle, '');
                expect.fail();
            } catch (err) {
                expect(err).equals('Unable to update server properties for server id - Invalid content');
            }

        });

        test('Return status ok if server is successfull updated', async () => {

            const updateStubs = stubs.outgoing.updateServer.callsFake(() => {
                return ProtocolStubs.updateServerResponse;
            });
            const result = await serverExplorer.saveServerProperties(ProtocolStubs.serverHandle, 'text');

            expect(updateStubs).calledOnce;
            expect(result).equals(ProtocolStubs.createResponseOK.status);

        });

        test('Return error if server is not updated', async () => {

            const updateStubs = stubs.outgoing.updateServer.callsFake(() => {
                ProtocolStubs.updateServerResponse.validation = ProtocolStubs.createResponseKO;
                return ProtocolStubs.updateServerResponse;
            });
            try {
                await serverExplorer.saveServerProperties(ProtocolStubs.serverHandle, 'text');

                expect(updateStubs).calledOnce;
                expect.fail();
            } catch (err) {
                expect(err).equals(ProtocolStubs.createResponseKO.status.message);
            }

        });

    });

    suite('onDidCloseTextDocument', () => {

        test('reject if doc is undefined', async () => {
            try {
                await serverEditorAdapter.onDidCloseTextDocument(undefined);
                expect.fail();
            } catch (err) {
            }
        });

        test('unlink if doc is tmp file', async () => {
            const unlinkStub = sandbox.stub(fs, 'unlink').callsFake((path, error) => {});

            await serverEditorAdapter.onDidCloseTextDocument(textDocumentWithUri);
            expect(unlinkStub).calledOnce;
        });

        test('don\'t do anything if file is not a tmp file', async () => {
            const unlinkStub = sandbox.stub(fs, 'unlink').callsFake((path, error) => {});

            await serverEditorAdapter.onDidCloseTextDocument(textDocumentWithoutTmpName);
            sandbox.assert.notCalled(unlinkStub);
        });

    });

});
