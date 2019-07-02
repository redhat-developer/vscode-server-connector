/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as chaipromise from 'chai-as-promised';
import * as cp from 'child_process';
import * as requirements from '../src/requirements';
import * as server from '../src/server';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { Readable } from 'stream';
import * as vscode from 'vscode';

const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaipromise);

suite('Server Tests', () => {
    let sandbox: sinon.SinonSandbox;

    const stdCallback: (data: string) => void = data => {};

    const readable: Readable = {
        on: () => new Readable(),
        _destroy: undefined,
        _read: undefined,
        addListener: undefined,
        destroy: undefined,
        emit: undefined,
        eventNames: undefined,
        getMaxListeners: undefined,
        isPaused: undefined,
        listenerCount: undefined,
        listeners: undefined,
        off: undefined,
        once: undefined,
        pause: undefined,
        pipe: undefined,
        prependListener: undefined,
        prependOnceListener: undefined,
        push: undefined,
        rawListeners: undefined,
        read: undefined,
        readable: false,
        readableHighWaterMark: undefined,
        readableLength: undefined,
        removeAllListeners: undefined,
        removeListener: undefined,
        resume: undefined,
        setEncoding: undefined,
        setMaxListeners: undefined,
        unpipe: undefined,
        unshift: undefined,
        wrap: undefined,
        [Symbol.asyncIterator]: undefined
    };

    const child: cp.ChildProcess = {
        addListener: undefined,
        channel: 1,
        connected: false,
        disconnect: () => {},
        emit: undefined,
        eventNames: undefined,
        getMaxListeners: undefined,
        kill: undefined,
        killed: false,
        listenerCount: undefined,
        listeners: undefined,
        off: undefined,
        on: undefined,
        once: undefined,
        pid: 33333333,
        prependListener: undefined,
        prependOnceListener: undefined,
        rawListeners: undefined,
        ref: undefined,
        removeAllListeners: undefined,
        removeListener: undefined,
        send: undefined,
        setMaxListeners: undefined,
        stderr: readable,
        stdin: undefined,
        stdio: undefined,
        stdout: readable,
        unref: undefined
    };

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('startRSP', () => {

        setup(() => {
            sandbox.stub(cp, 'spawn').callsFake((command, args, options) => {
                return child;
            });
        });

        // test('check that resolveRequirement is being called', async () => {
        //     const resolveStub = sandbox.stub(requirements, 'resolveRequirements').resolves({ java_home: '', java_version: 10});
        //     await server.start(stdCallback, stdCallback);
        //     expect(resolveStub).calledOnce;
        // });

        test('error if resolveRequirement fails', async () => {
            sandbox.stub(requirements, 'resolveRequirements').rejects({ message: 'error', label: 'label'});
            const errorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            try {
                await server.start(stdCallback, stdCallback);
                expect(errorStub).calledOnceWith('error', 'label');
            } catch (err) {

            }
        });

    });
});
