/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as requirements from '../../src/requirements';
import * as server from '../../src/server';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { OPTIONS } from '../../src/constants';

const expect = chai.expect;
chai.use(sinonChai);

suite('Server Tests', () => {
    let sandbox: sinon.SinonSandbox;

    const stdCallback: (data: string) => void = data => { /* do nothing */ };

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('startRSP', () => {

        test('error if resolveRequirement fails', async () => {
            sandbox.stub(requirements, 'resolveRequirements').rejects({ message: 'error', btns: [{ label: 'label'}]});
            try {
                const launcher = new server.FelixRspLauncher(OPTIONS);
                await launcher.start(stdCallback, stdCallback, null);
                expect.fail('No error was thrown');
            } catch (err) {
                expect(err.message).equals('error');
                expect(err.btns.length).equals(1);
                expect(err.btns[0].label).equals('label');
            }
        });

    });
});
