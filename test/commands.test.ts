/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { CommandHandler } from '../src/extensionApi';
import { Protocol, ServerState } from 'rsp-client';
import { ServersViewTreeDataProvider } from '../src/serverExplorer';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { Stubs } from './stubs';
import * as vscode from 'vscode';

const expect = chai.expect;
chai.use(sinonChai);

suite('Command Handler', () => {
    let sandbox: sinon.SinonSandbox;
    let sandboxDebug: sinon.SinonSandbox;
    let stubs: Stubs;
    let handler: CommandHandler;
    let serverExplorer: ServersViewTreeDataProvider;

    const serverType: Protocol.ServerType = {
        id: 'type',
        description: 'a type',
        visibleName: 'the type'
    };

    const serverHandle: Protocol.ServerHandle = {
        id: 'id',
        type: serverType
    };

    const serverState: Protocol.ServerState =  {
        server: serverHandle,
        deployableStates: [],
        publishState: 0,
        state: 0
    };

    const status: Protocol.Status = {
        code: 0,
        message: 'ok',
        severity: 0,
        ok: true,
        plugin: 'unknown',
        trace: ''
    };

    const errorStatus: Protocol.Status = {
        code: 0,
        message: 'Critical Error',
        ok: false,
        plugin: 'plugin',
        severity: 4,
        trace: ''
    };

    const simpleContext = {
        id: 'id'
    };
    const context = {
        id: 'id',
        type: serverType
    };

    setup(() => {
        sandbox = sinon.createSandbox();
        sandboxDebug = sinon.createSandbox();

        stubs = new Stubs(sandbox);
        stubs.outgoing.getServerHandles.resolves([serverHandle]);
        serverExplorer = new ServersViewTreeDataProvider(stubs.client);
        handler = new CommandHandler(serverExplorer, stubs.client);

        serverExplorer.serverStatus.set('server', serverState);
    });

    teardown(() => {
        sandbox.restore();
        sandboxDebug.restore();
    });

    test('activate registers event listeners', async () => {
        sinon.spy(stubs.incoming.onServerAdded);
        sinon.spy(stubs.incoming.onServerRemoved);
        sinon.spy(stubs.incoming.onServerStateChanged);
        sinon.spy(stubs.incoming.onServerProcessOutputAppended);

        await handler.activate();

        expect(stubs.incoming.onServerAdded).calledOnce;
        expect(stubs.incoming.onServerRemoved).calledOnce;
        expect(stubs.incoming.onServerStateChanged).calledOnce;
        expect(stubs.incoming.onServerProcessOutputAppended).calledOnce;
    });

    suite('startServer', () => {
        let statusStub: sinon.SinonStub;
        let startStub: sinon.SinonStub;

        const cmdDetails: Protocol.CommandLineDetails = {
            cmdLine: [''],
            envp: [],
            properties: {},
            workingDir: 'dir'
        };

        const response: Protocol.StartServerResponse = {
            details: cmdDetails,
            status: status
        };

        setup(() => {
            statusStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(serverState);
            startStub = sandbox.stub().resolves(response);
            stubs.outgoing.startServerAsync = startStub;
        });

        test('works with injected context', async () => {
            const result = await handler.startServer('run', serverState);
            const args: Protocol.LaunchParameters = {
                mode: 'run',
                params: {
                    serverType: context.type.id,
                    id: context.id,
                    attributes: new Map<string, any>()
                }
            };

            expect(result).equals(response);
            expect(startStub).calledOnceWith(args);
        });

        test('works without injected context', async () => {
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
            const result = await handler.startServer('run');
            const args: Protocol.LaunchParameters = {
                mode: 'run',
                params: {
                    serverType: serverType.id,
                    id: 'id',
                    attributes: new Map<string, any>()
                }
            };

            expect(result).equals(response);
            expect(startStub).calledOnceWith(args);
        });

        test('errors if the server is already running', async () => {
            statusStub.returns(ServerState.STARTED);

            try {
                await handler.startServer('run', serverState);
                expect.fail();
            } catch (err) {
                expect(err).equals('The server is already running.');
            }
        });

        test('throws any errors coming from the rsp client', async () => {
            const result: Protocol.StartServerResponse = {
                details: cmdDetails,
                status: errorStatus
            };
            startStub.resolves(result);

            try {
                await handler.startServer('run', serverState);
                expect.fail();
            } catch (err) {
                expect(err).equals(errorStatus.message);
            }
        });
    });

    suite('debugServer', () => {
        let statusStub: sinon.SinonStub;
        let startStub: sinon.SinonStub;

        const cmdDetails: Protocol.CommandLineDetails = {
            cmdLine: [''],
            envp: [],
            properties: {
                'debug.details.type': 'c#'
            },
            workingDir: 'dir'
        };

        const response: Protocol.StartServerResponse = {
            details: cmdDetails,
            status: status
        };

        setup(() => {
            statusStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(serverState);
            startStub = sandbox.stub().resolves(response);
            stubs.outgoing.startServerAsync = startStub;
        });

        test('display error if no extension found', async () => {
            const stubM = sinon.stub(handler, 'checkExtension' as any);
            stubM.resolves('Debugger for Java extension is required. Install/Enable it before proceeding.');
            const sinonSpy = sandbox.spy(vscode.window, 'showErrorMessage');
            await handler.debugServer(serverState);
            sinon.assert.calledOnce(sinonSpy);
        });

        test('display error if language is not supported', async () => {
            sandbox.stub(serverExplorer, 'retrieveDebugInfo').resolves(cmdDetails);
            const sinonSpy = sandbox.spy(vscode.window, 'showErrorMessage');
            await handler.debugServer(serverState);
            sandbox.assert.calledOnce(sinonSpy);
        });

        test('works with injected context', async () => {
            sandbox.stub(handler, 'checkExtension' as any).resolves(undefined);
            sandbox.stub(handler, 'openProjectToDebug' as any).resolves(vscode.Uri);
            const sinonSpy = sandbox.spy(handler, 'startServer');
            const sinonSpyDebug = sandbox.spy(vscode.debug, 'startDebugging');

            await handler.debugServer(serverState);
            sandbox.assert.calledOnce(sinonSpy);
            sandbox.assert.calledOnce(sinonSpyDebug);
        });

        test('works without injected context', async () => {
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
            sandbox.stub(handler, 'checkExtension' as any).resolves(undefined);
            sandbox.stub(handler, 'openProjectToDebug' as any).resolves(vscode.Uri);
            const sinonSpy = sandbox.spy(handler, 'startServer');
            const sinonSpyDebug = sandbox.spy(vscode.debug, 'startDebugging');

            await handler.debugServer(undefined);
            sandbox.assert.calledOnce(sinonSpy);
            sandbox.assert.calledOnce(sinonSpyDebug);
        });

    });

    suite('stopServer', () => {
        let statusStub: sinon.SinonStub;
        let stopStub: sinon.SinonStub;

        setup(() => {
            const serverStateInternal: Protocol.ServerState =  {
                server: serverHandle,
                deployableStates: [],
                publishState: 0,
                state: ServerState.STARTED
            };

            statusStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(serverStateInternal);
            stopStub = stubs.outgoing.stopServerAsync.resolves(status);
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
        });

        test('works with injected context', async () => {
            const result = await handler.stopServer(serverState);
            const args: Protocol.StopServerAttributes = {
                id: simpleContext.id,
                force: true
            };

            expect(result).equals(status);
            expect(stopStub).calledOnceWith(args);
        });

        test('works without injected context', async () => {
            const result = await handler.stopServer();
            const args: Protocol.StopServerAttributes = {
                id: 'id',
                force: true
            };

            expect(result).equals(status);
            expect(stopStub).calledOnceWith(args);
        });

        test('errors if the server is already stopped', async () => {
            statusStub.returns(ServerState.STOPPED);

            try {
                await handler.stopServer(serverState);
                expect.fail();
            } catch (err) {
                expect(err).equals('The server is already stopped.');
            }
        });

        test('throws any errors coming from the rsp client', async () => {
            stopStub.resolves(errorStatus);

            try {
                await handler.stopServer(serverState);
                expect.fail();
            } catch (err) {
                expect(err).equals(errorStatus.message);
            }
        });
    });

    suite('removeServer', () => {
        let statusStub: sinon.SinonStub;
        let removeStub: sinon.SinonStub;

        setup(() => {
            const serverStateInternal: Protocol.ServerState =  {
                server: serverHandle,
                deployableStates: [],
                publishState: 0,
                state: ServerState.STOPPED
            };

            statusStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(serverStateInternal);
            removeStub = stubs.outgoing.deleteServer.resolves(status);
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
        });

        test('works with injected context', async () => {
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            const result = await handler.removeServer(serverState);
            const args: Protocol.ServerHandle = {
                id: context.id,
                type: context.type
            };

            expect(result).equals(status);
            expect(removeStub).calledOnceWith(args);
        });

        test('works without injected context', async () => {
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            const result = await handler.removeServer();
            const args: Protocol.ServerHandle = {
                id: 'id',
                type: serverType
            };

            expect(result).equals(status);
            expect(removeStub).calledOnceWith(args);
        });

        test('errors if the server is not stopped', async () => {
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            statusStub.returns(ServerState.STARTED);

            try {
                await handler.removeServer(serverState);
                expect.fail();
            } catch (err) {
                expect(err).to.include(serverState.server.id);
            }
        });

        test('throws any errors coming from the rsp client', async () => {
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            removeStub.resolves(errorStatus);

            try {
                await handler.removeServer(serverState);
                expect.fail();
            } catch (err) {
                expect(err).equals(errorStatus.message);
            }
        });

        test('wont remove if user does not confirm', async () => {
            sandbox.stub(vscode.window, 'showWarningMessage').resolves();
            expect(removeStub).not.called;
        });
    });

    suite('restartServer', () => {
        let startStub: sinon.SinonStub;
        let stopStub: sinon.SinonStub;
        const startedState: Protocol.ServerState = {
            deployableStates: [],
            publishState: 0, server:
            serverHandle,
            state: ServerState.STARTED
        };

        setup(() => {
            serverExplorer.serverStatus.set('server', startedState);
            sandbox.stub(serverExplorer.serverStatus, 'get').returns(startedState);
            startStub = stubs.outgoing.startServerAsync.resolves(status);
            stopStub = stubs.outgoingSync.stopServerSync.resolves(status);
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
        });

        test('works with injected context', async () => {
            await handler.restartServer(serverState);
            const stopArgs: Protocol.StopServerAttributes = {
                id: context.id,
                force: true
            };
            const startArgs: Protocol.LaunchParameters = {
                mode: 'run',
                params: {
                    id: context.id,
                    serverType: context.type.id,
                    attributes: new Map<string, any>()
                }
            };

            expect(stopStub).calledOnceWith(stopArgs);
            expect(startStub).calledAfter(stopStub);
            expect(startStub).calledOnceWith(startArgs);
        });

        test('works without injected context', async () => {
            await handler.restartServer();
            const stopArgs: Protocol.StopServerAttributes = {
                id: 'id',
                force: true
            };
            const startArgs: Protocol.LaunchParameters = {
                mode: 'run',
                params: {
                    id: 'id',
                    serverType: serverType.id,
                    attributes: new Map<string, any>()
                }
            };

            expect(stopStub).calledOnceWith(stopArgs);
            expect(startStub).calledAfter(stopStub);
            expect(startStub).calledOnceWith(startArgs);
        });
    });

    suite('addLocation', () => {

        test('calls addLocation from server explorer', async () => {
            sandbox.stub(serverExplorer, 'addLocation').resolves(undefined);
            await handler.addLocation();
            expect(serverExplorer.addLocation).calledOnce;
        });

        test('errors if server explorer is not initialized', async () => {
            const nullHandler = new CommandHandler(null, stubs.client);

            try {
                await nullHandler.addLocation();
                expect.fail();
            } catch (err) {
                expect(err).equals('Runtime Server Protocol (RSP) Server is starting, please try again later.');
            }
        });
    });

    suite('infoServer', () => {

        test('errors if server explorer is not initialized', async () => {
            const nullHandler = new CommandHandler(null, stubs.client);

            try {
                await nullHandler.infoServer();
                expect.fail();
            } catch (err) {
                expect(err).equals('Runtime Server Protocol (RSP) Server is starting, please try again later.');
            }
        });
    });
});
