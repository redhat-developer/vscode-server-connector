/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as vscode from 'vscode';
import { Protocol } from 'rsp-client';
import { Stubs } from './stubs';
import { JobProgress } from '../src/jobprogress';

const expect = chai.expect;
chai.use(sinonChai);

class CancellationStub implements vscode.CancellationToken {
    isCancellationRequested: boolean;
    onCancellationRequested: vscode.Event<any> =
      function () { return { dispose() { } }; };
}
class ProgressStub implements vscode.Progress<{ message: string, increment: number }> {
    report(value: { message: string, increment: number }): void {
    }
}

suite('Job Progress', () => {
    let sandbox: sinon.SinonSandbox;
    let stubs: Stubs;
    const job: Protocol.JobHandle = {
        name: 'papa smurf',
        id: 'papa.smurf.id'
    };
    const otherJob: Protocol.JobHandle = {
        name: 'smurfette',
        id: 'smurfette.id'
    };
    let cancellationStub: vscode.CancellationToken;
    let progressStub: vscode.Progress<{ message: string, increment: number }>;
    let progressStubReport: sinon.SinonSpy<[{ message: string; increment: number; }], void>;
    let withProgressFake: (
        options: vscode.ProgressOptions,
        task: (progress: vscode.Progress<{ message: string; increment: number }>, token: vscode.CancellationToken) => Thenable<{}>) => Thenable<{}>;
    let withProgressFakeSpy;

    setup(() => {
      sandbox = sinon.createSandbox();
      stubs = new Stubs(sandbox);

      stubs.incoming.onJobAdded = sandbox.stub();
      stubs.incoming.onJobRemoved = sandbox.stub();
      stubs.incoming.onJobChanged = sandbox.stub();

      cancellationStub = new CancellationStub();
      progressStub = new ProgressStub();
      progressStubReport = sandbox.spy(progressStub, 'report');
      withProgressFake = (
          options: vscode.ProgressOptions,
          task: (progress: vscode.Progress<{ message: string; increment: number }>, token: vscode.CancellationToken) => Thenable<{}>) => {
          return task(progressStub, cancellationStub);
      };
      withProgressFakeSpy = sandbox.stub(vscode.window, 'withProgress').callsFake(withProgressFake);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('JobProgress registers onJobAdded listener', () => {
        // when
        JobProgress.create(stubs.client);
        // then
        expect(stubs.incoming.onJobAdded).calledOnce;
    });

    test('onJobAdded notification should open window with progress', () => {
        // given
        JobProgress.create(stubs.client);
        expect(stubs.incoming.onJobAdded).calledOnce;

        // when
        callOnJobAddedListenerWith(job, stubs.incoming.onJobAdded);

        // then
        expect(withProgressFakeSpy).calledOnce;
    });

    test('onJobAdded notification should register listeners for onJobChanged, onJobRemoved', () => {
        // given
        JobProgress.create(stubs.client);

        // when
        callOnJobAddedListenerWith(job, stubs.incoming.onJobAdded);

        // then
        expect(stubs.incoming.onJobChanged).calledOnce;
        expect(stubs.incoming.onJobRemoved).calledOnce;
    });

    test('onJobChanged notification should be reported incrementally', () => {
        // given
        const jobProgress10: Protocol.JobProgress = {
          percent: 10,
          handle: job
        };
        const jobProgress40: Protocol.JobProgress = {
          percent: 40,
          handle: job
        };
        JobProgress.create(stubs.client);

        // when
        callOnJobAddedListenerWith(job, stubs.incoming.onJobAdded);
        callOnJobChangedListenerWith(jobProgress10, stubs.incoming.onJobChanged);
        callOnJobChangedListenerWith(jobProgress40, stubs.incoming.onJobChanged);

        // then
        // notification reports absolute progress, vscode.Progress has relative progress (increment)
        // 1. report: increment 0,
        // 2. report: increment jobProgress10.percent - 0
        // 3. report: increment jobProgress40.percent - jobProgress10.percent
        expect(progressStubReport.args).to.have.lengthOf(3);
        expect(progressStubReport.getCall(1).args[0]).to.deep.property('increment', jobProgress10.percent - 0);
        expect(progressStubReport.getCall(2).args[0]).to.deep.property('increment', jobProgress40.percent - jobProgress10.percent);
    });

    test('onJobChanged notification should not be reported if other job', () => {
        // given
        const otherJobProgress: Protocol.JobProgress = {
          percent: 10,
          handle: otherJob
        };
        JobProgress.create(stubs.client);

        // when
        callOnJobAddedListenerWith(job, stubs.incoming.onJobAdded);
        callOnJobChangedListenerWith(otherJobProgress, stubs.incoming.onJobChanged);

        // then
        // only initial progress report where increment is initialized to 0
        // 2nd change is not reported bcs is different job
        expect(progressStubReport).calledOnce;
        expect(progressStubReport.getCall(0).args[0]).to.deep.property('increment', 0);
    });

    test('registers onCancellationRequested listener', () => {
        // given
        const onCancellationSpy = sandbox.spy(cancellationStub, 'onCancellationRequested');
        JobProgress.create(stubs.client);

        // when
        callOnJobAddedListenerWith(job, stubs.incoming.onJobAdded);

        // then
        // only initial progress report sets increment to 0, 2nd change is not reported bcs is different job
        expect(onCancellationSpy).calledOnce;
      });

      test('cancelling CancellationToke cancels job', () => {
        // given
        const onCancellationSpy = sandbox.spy(cancellationStub, 'onCancellationRequested');
        stubs.outgoing.cancelJob = sinon.stub().withArgs(job).resolves();

        JobProgress.create(stubs.client);
        callOnJobAddedListenerWith(job, stubs.incoming.onJobAdded);

        // when
        callOnCancellationRequestionListener(onCancellationSpy);

        // then
        expect(stubs.outgoing.cancelJob).calledOnceWith(job);
    });
});

/**
 * Calls the listener that's registered against jobAdded notifications.
 * This removes the need to emulate job event notifications.
 *
 * @param job the job to be given to the listener
 * @param spy the spy of the
 */
function callOnJobAddedListenerWith(job: Protocol.JobHandle, spy: sinon.SinonStub<any[], any>) {
    // verify that onJobAdded (which added a listener) was called
    expect(spy).calledOnce;
    const onJobAddedListener = spy.args[0][0];
    expect(onJobAddedListener).to.be.an.instanceof(Function);
    onJobAddedListener(job);
}

function callOnJobChangedListenerWith(jobProgress: Protocol.JobProgress, spy: sinon.SinonStub<any[], any>) {
    // verify that onJobRemoved (which added a listener) was called
    expect(spy).calledOnce;
    const onJobChangedListener = spy.args[0][0];
    expect(onJobChangedListener).to.be.an.instanceof(Function);
    onJobChangedListener(jobProgress);
}

function callOnCancellationRequestionListener(spy: sinon.SinonSpy<[(e: any) => any, any?, vscode.Disposable[]?], vscode.Disposable>) {
    expect(spy).calledOnce;
    const onCancellationRequestedListener = spy.args[0][0];
    expect(onCancellationRequestedListener).to.be.an.instanceof(Function);
    onCancellationRequestedListener(null);
}
