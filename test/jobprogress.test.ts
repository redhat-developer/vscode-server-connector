/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as chaipromise from 'chai-as-promised';
import { ClientStubs } from './clientstubs';
import { JobProgress } from '../src/jobprogress';
import { Protocol } from 'rsp-client';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as vscode from 'vscode';
import { fail } from 'assert';

const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaipromise);

class CancellationStub implements vscode.CancellationToken {
    public isCancellationRequested: boolean;
    public onCancellationRequested: vscode.Event<any> = () => {
        return {dispose() {}};
    }
}

suite('Job Progress', () => {
    let sandbox: sinon.SinonSandbox;
    let stubs: ClientStubs;
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
    let progressTaskPromise: Thenable<{}>;
    let withProgressFake: (
        options: vscode.ProgressOptions,
        task: (progress: vscode.Progress<{ message: string; increment: number }>, token: vscode.CancellationToken) => Thenable<{}>) => Thenable<{}>;
    let withProgressFakeSpy;

    setup(() => {
        sandbox = sinon.createSandbox();
        stubs = new ClientStubs(sandbox);

        stubs.incoming.onJobAdded = sandbox.stub();
        stubs.incoming.onJobRemoved = sandbox.stub();
        stubs.incoming.onJobChanged = sandbox.stub();

        cancellationStub = new CancellationStub();
        progressStub = {
            report: (value: { message: string, increment: number }) => void {
            }
        };
        progressStubReport = sandbox.spy(progressStub, 'report');
        withProgressFake = (
            options: vscode.ProgressOptions, task: (
            progress: vscode.Progress<{ message: string; increment: number }>, token: vscode.CancellationToken)
            => Thenable<{}>) => {
            progressTaskPromise = task(progressStub, cancellationStub);
            return progressTaskPromise;
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

    test('cancelling CancellationToken cancels job', () => {
        // given
        const onCancellationSpy = sandbox.spy(cancellationStub, 'onCancellationRequested');
        stubs.outgoing.cancelJob = sandbox.stub().withArgs(job).resolves();

        JobProgress.create(stubs.client);
        callOnJobAddedListenerWith(job, stubs.incoming.onJobAdded);

        // when
        callOnCancellationRequestionListener(onCancellationSpy);

        // then
        expect(stubs.outgoing.cancelJob).calledOnceWith(job);
        expect(progressTaskPromise).to.be.rejected;
    });

    test('show error that contains message & (start of) trace if job removal ended with error', () => {
        // given
        sandbox.stub(vscode.window, 'showErrorMessage');
        const timeoutStatus: Protocol.Status = {
            severity: 4,
            plugin: 'org.jboss.tools.rsp.runtime.core',
            code: 0,
            message: 'Error while retrieving runtime from http://download.jboss.org/jbossas/7.1/jboss-as-7.1.0.Final/jboss-as-7.1.0.Final.zip?use_mirror=autoselect',
            trace: `org.jboss.tools.rsp.eclipse.core.runtime.CoreException: Read timed out\n
            \tat org.jboss.tools.rsp.runtime.core.util.internal.DownloadRuntimeOperationUtility.downloadRemoteRuntime(DownloadRuntimeOperationUtility.java:188)\n
            \tat org.jboss.tools.rsp.runtime.core.util.internal.DownloadRuntimeOperationUtility.downloadAndUnzip(DownloadRuntimeOperationUtility.java:152)\n
            \tat org.jboss.tools.rsp.runtime.core.model.installer.internal.ExtractionRuntimeInstaller.installRuntime(ExtractionRuntimeInstaller.java:40)\n
            \tat org.jboss.tools.rsp.server.spi.runtimes.AbstractLicenseOnlyDownloadExecutor$1.run(AbstractLicenseOnlyDownloadExecutor.java:149)\n
            \tat org.jboss.tools.rsp.server.spi.jobs.SimpleJob.run(SimpleJob.java:96)\n
            \tat org.jboss.tools.rsp.server.jobs.JobManager.lambda$0(JobManager.java:86)\n
            \tat java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1149)\n
            \tat java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:624)\n
            \tat java.lang.Thread.run(Thread.java:748)\n
            Caused by: java.net.SocketTimeoutException: Read timed out\n
            \tat java.net.SocketInputStream.socketRead0(Native Method)\n
            \tat java.net.SocketInputStream.socketRead(SocketInputStream.java:116)\n
            \tat java.net.SocketInputStream.read(SocketInputStream.java:171)\n
            \tat java.net.SocketInputStream.read(SocketInputStream.java:141)\n
            \tat java.io.BufferedInputStream.read1(BufferedInputStream.java:284)\n
            \tat java.io.BufferedInputStream.read(BufferedInputStream.java:345)\n
            \tat sun.net.www.MeteredStream.read(MeteredStream.java:134)\n
            \tat java.io.FilterInputStream.read(FilterInputStream.java:133)\n
            \tat sun.net.www.protocol.http.HttpURLConnection$HttpInputStream.read(HttpURLConnection.java:3393)\n
            \tat java.nio.channels.Channels$ReadableByteChannelImpl.read(Channels.java:385)\n
            \tat org.jboss.tools.rsp.foundation.core.transport.CallbackByteChannel.read(CallbackByteChannel.java:52)\n
            \tat sun.nio.ch.FileChannelImpl.transferFromArbitraryChannel(FileChannelImpl.java:673)\n
            \tat sun.nio.ch.FileChannelImpl.transferFrom(FileChannelImpl.java:711)\n
            \tat org.jboss.tools.rsp.foundation.core.transport.URLTransportCache.download(URLTransportCache.java:423)\n
            \tat org.jboss.tools.rsp.foundation.core.transport.URLTransportCache.download(URLTransportCache.java:382)\n
            \tat org.jboss.tools.rsp.runtime.core.util.internal.DownloadRuntimeOperationUtility.downloadFileFromRemoteUrl(DownloadRuntimeOperationUtility.java:250)\n
            \tat org.jboss.tools.rsp.runtime.core.util.internal.DownloadRuntimeOperationUtility.downloadRemoteRuntime(DownloadRuntimeOperationUtility.java:185)\n
            \t... 8 more\n`,
            ok: false
        };
        const jobRemovedTimeout: Protocol.JobRemoved = {
            handle: job,
            status: timeoutStatus
        };
        JobProgress.create(stubs.client);
        callOnJobAddedListenerWith(job, stubs.incoming.onJobAdded);

        // when
        callOnJobRemovedListenerWith(jobRemovedTimeout, stubs.incoming.onJobRemoved);

        // then
        progressTaskPromise.then(
            () => {
                fail('task promise expected to be rejected but was resolved.');
            },
            (reason: string) => {
                expect(reason).to.match(/Error while retrieving runtime from .+: Read timed out/g);
            });
    });

    test('show error that contains only message if there is no trace if job removal ended with error', () => {
        // given
        sandbox.stub(vscode.window, 'showErrorMessage');
        const timeoutStatus: Protocol.Status = {
            severity: 4,
            plugin: undefined,
            code: 0,
            message: 'Error',
            trace: undefined,
            ok: false
        };
        const jobRemovedTimeout: Protocol.JobRemoved = {
            handle: job,
            status: timeoutStatus
        };
        JobProgress.create(stubs.client);
        callOnJobAddedListenerWith(job, stubs.incoming.onJobAdded);

        // when
        callOnJobRemovedListenerWith(jobRemovedTimeout, stubs.incoming.onJobRemoved);

        // then
        expect(progressTaskPromise).to.eventually.rejectedWith('Error');
    });

    test('dont show error if job removal ended with success', () => {
        // given
        const timeoutStatus: Protocol.Status = {
            severity: 0,
            plugin: undefined,
            code: 0,
            message: undefined,
            trace: undefined,
            ok: true
        };
        const jobRemovedTimeout: Protocol.JobRemoved = {
            handle: job,
            status: timeoutStatus
        };
        JobProgress.create(stubs.client);
        callOnJobAddedListenerWith(job, stubs.incoming.onJobAdded);

        // when
        callOnJobRemovedListenerWith(jobRemovedTimeout, stubs.incoming.onJobRemoved);

        // then
        expect(progressTaskPromise).to.eventually.equal(job);
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

function callOnJobRemovedListenerWith(jobRemoved: Protocol.JobRemoved, spy: sinon.SinonStub<any[], any>) {
    // verify that onJobRemoved (which added a listener) was called
    expect(spy).calledOnce;
    const onJobRemovedListener = spy.args[0][0];
    expect(onJobRemovedListener).to.be.an.instanceof(Function);
    onJobRemovedListener(jobRemoved);
}

function callOnCancellationRequestionListener(spy: sinon.SinonSpy<[(e: any) => any, any?, vscode.Disposable[]?], vscode.Disposable>) {
    expect(spy).calledOnce;
    const onCancellationRequestedListener = spy.args[0][0];
    expect(onCancellationRequestedListener).to.be.an.instanceof(Function);
    onCancellationRequestedListener(null);
}
