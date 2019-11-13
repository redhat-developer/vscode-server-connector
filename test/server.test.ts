/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as requirements from '../src/requirements';
import * as server from '../src/server';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as vscode from 'vscode';

const expect = chai.expect;
chai.use(sinonChai);

suite('Server Tests', () => {
    let sandbox: sinon.SinonSandbox;

    const stdCallback: (data: string) => void = data => {};

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('startRSP', () => {

        test('error if resolveRequirement fails', async () => {
            sandbox.stub(requirements, 'resolveRequirements').rejects({ message: 'error', btns: [{ label: 'label'}]});
            const errorStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
            try {
                await server.start(stdCallback, stdCallback, null);
                expect.fail('No error was thrown');
            } catch (err) {
                expect(errorStub).calledOnceWith('error', 'label');
            }
        });

    });
});
