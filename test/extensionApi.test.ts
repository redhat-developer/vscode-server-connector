/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { FelixRspController } from '../src/controller';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { ServerInfo } from 'vscode-server-connector-api';
import { OPTIONS } from '../src/constants';

const expect = chai.expect;
chai.use(sinonChai);

suite('Extension API', () => {
    let sandbox: sinon.SinonSandbox;
    let extensionApi: FelixRspController;

    const serverInfo: ServerInfo = {
        host: 'localhost',
        port: 8080
    };

    const stdCallback: (data: string) => void = data => { /* do nothing */ };

    setup(() => {
        sandbox = sinon.createSandbox();
        extensionApi = new FelixRspController(OPTIONS);
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('startRSP', () => {

        test('check that updateRSPStateChanged is being called twice', async () => {
            const updateRSPStateStub = sandbox.stub(extensionApi, 'updateRSPStateChanged');
            sandbox.stub(extensionApi.getLauncher(), 'start').resolves(serverInfo);
            await extensionApi.startRSP(stdCallback, stdCallback);
            expect(updateRSPStateStub).calledTwice;
        });

        test('check that server start is called with right params', async () => {
            const startStub = sandbox.stub(extensionApi.getLauncher(), 'start').resolves(serverInfo);
            await extensionApi.startRSP(stdCallback, stdCallback);
            expect(startStub).calledOnceWith(stdCallback, stdCallback);
        });

        test('check that updateRSPStateChanged is being called twice if starting server fail', async () => {
            const updateRSPStateStub = sandbox.stub(extensionApi, 'updateRSPStateChanged');
            sandbox.stub(extensionApi.getLauncher(), 'start').rejects();
            try {
                await extensionApi.startRSP(stdCallback, stdCallback);
                expect.fail('No error was thrown');
            } catch (err) {
                expect(updateRSPStateStub).calledTwice;
            }
        });

        test('error if starting server fail', async () => {
            sandbox.stub(extensionApi.getLauncher(), 'start').rejects();
            try {
                await extensionApi.startRSP(stdCallback, stdCallback);
                expect.fail('No error was thrown');
            } catch (err) {
                expect(err).equals('RSP Error - Red Hat Server Connector failed to start - Error');
            }
        });

    });

    suite('stopRSP', () => {

        test('check server terminate is called', async () => {
            const stopStub = sandbox.stub(extensionApi.getLauncher(), 'terminate').resolves();
            await extensionApi.stopRSP();
            expect(stopStub).calledOnce;
        });
    });

    suite('getHost', () => {

        test('check if correct host is returned after startRSP is called', async () => {
            let host = extensionApi.getHost();
            expect(host).equals('');
            sandbox.stub(extensionApi.getLauncher(), 'start').resolves(serverInfo);
            await extensionApi.startRSP(stdCallback, stdCallback);
            host = extensionApi.getHost();
            expect(host).equals('localhost');
        });
    });

    suite('getPort', () => {

        test('check if correct port is returned after startRSp is called', async () => {
            let port = extensionApi.getPort();
            expect(port).equals(0);
            sandbox.stub(extensionApi.getLauncher(), 'start').resolves(serverInfo);
            await extensionApi.startRSP(stdCallback, stdCallback);
            port = extensionApi.getPort();
            expect(port).equals(8080);
        });
    });
});
