/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { ClientStubs } from './clientstubs';
import { DebugInfo } from '../src/debugInfo';
import { DebugInfoProvider } from '../src/debugInfoProvider';
import { CommandHandler } from '../src/extensionApi';
import { ProtocolStubs } from './protocolstubs';
import { Protocol, ServerState } from 'rsp-client';
import { ServerExplorer } from '../src/serverExplorer';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as vscode from 'vscode';

const expect = chai.expect;
chai.use(sinonChai);

suite('Command Handler', () => {
    let sandbox: sinon.SinonSandbox;
    let sandboxDebug: sinon.SinonSandbox;
    let stubs: ClientStubs;
    let handler: CommandHandler;
    let serverExplorer: ServerExplorer;

    const simpleContext = {
        id: 'id'
    };
    const context = {
        id: 'id',
        type: ProtocolStubs.serverType
    };

    setup(() => {
        sandbox = sinon.createSandbox();
        sandboxDebug = sinon.createSandbox();

        stubs = new ClientStubs(sandbox);
        stubs.outgoing.getServerHandles = sandbox.stub().resolves([ProtocolStubs.serverHandle]);
        stubs.outgoing.getServerState = sandbox.stub().resolves(ProtocolStubs.serverState);
        serverExplorer = new ServerExplorer(stubs.client);
        handler = new CommandHandler(serverExplorer, stubs.client);

        serverExplorer.serverStatus.set('server', ProtocolStubs.serverState);
    });

    teardown(() => {
        sandbox.restore();
        sandboxDebug.restore();
    });

    test('activate registers event listeners', async () => {
        stubs.incoming.onServerAdded.reset();
        stubs.incoming.onServerRemoved.reset();
        stubs.incoming.onServerStateChanged.reset();
        stubs.incoming.onServerProcessOutputAppended.reset();

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
            status: ProtocolStubs.status
        };

        setup(() => {
            statusStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(ProtocolStubs.serverState);
            startStub = sandbox.stub().resolves(response);
            stubs.outgoing.startServerAsync = startStub;
        });

        test('works with injected context', async () => {
            const result = await handler.startServer('run', ProtocolStubs.serverState);
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
                    serverType: ProtocolStubs.serverType.id,
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
                await handler.startServer('run', ProtocolStubs.serverState);
                expect.fail();
            } catch (err) {
                expect(err).equals('The server is already running.');
            }
        });

        test('throws any errors coming from the rsp client', async () => {
            const result: Protocol.StartServerResponse = {
                details: cmdDetails,
                status: ProtocolStubs.errorStatus
            };
            startStub.resolves(result);

            try {
                await handler.startServer('run', ProtocolStubs.serverState);
                expect.fail();
            } catch (err) {
                expect(err).equals(ProtocolStubs.errorStatus.message);
            }
        });
    });

    suite('debugServer', () => {
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
            status: ProtocolStubs.status
        };

        setup(() => {
            startStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(ProtocolStubs.serverState);
            startStub = sandbox.stub().resolves(response);
            stubs.outgoing.startServerAsync = startStub;
        });

        test('display error if no extension found', async () => {
            const stubM = sinon.stub(handler, 'checkExtension' as any);
            stubM.resolves('Debugger for Java extension is required. Install/Enable it before proceeding.');
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
            await handler.debugServer(ProtocolStubs.serverState);
            sinon.assert.calledOnce(showErrorMessageStub);
        });

        test('display error if language is not supported', async () => {
            const debugInfo: DebugInfo = new DebugInfo(sandbox.stub() as unknown as Protocol.CommandLineDetails);
            sandbox.stub(debugInfo, 'isJavaType').returns(false);
            sandbox.stub(DebugInfoProvider, 'retrieve').resolves(debugInfo);
            const startServerStub = givenServerStarted(sandbox, handler);
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
            await handler.debugServer(ProtocolStubs.serverState);
            sandbox.assert.calledOnce(showErrorMessageStub);
            sandbox.assert.notCalled(startServerStub);
        });

        test('starts server & debugging with injected context', async () => {
            givenDebugTypeIsSupported(sandbox, handler);
            const startServerStub = givenServerStarted(sandbox, handler);
            const startDebuggingStub = sandbox.stub(vscode.debug, 'startDebugging');

            await handler.debugServer(ProtocolStubs.serverState);
            sandbox.assert.calledOnce(startServerStub);
            sandbox.assert.calledOnce(startDebuggingStub);
        });

        test('starts server & debugging without injected context', async () => {
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
            givenDebugTypeIsSupported(sandbox, handler);
            const startServerStub = givenServerStarted(sandbox, handler);
            const startDebuggingStub = sandbox.stub(vscode.debug, 'startDebugging');

            await handler.debugServer(undefined);
            sandbox.assert.calledOnce(startServerStub);
            sandbox.assert.calledOnce(startDebuggingStub);
        });

    });

    suite('stopServer', () => {
        let statusStub: sinon.SinonStub;
        let stopStub: sinon.SinonStub;

        setup(() => {
            const serverStateInternal: Protocol.ServerState =  {
                server: ProtocolStubs.serverHandle,
                deployableStates: [],
                publishState: 0,
                state: ServerState.STARTED
            };

            statusStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(serverStateInternal);
            stopStub = stubs.outgoing.stopServerAsync.resolves(ProtocolStubs.status);
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
        });

        test('works with injected context', async () => {
            const result = await handler.stopServer(ProtocolStubs.serverState);
            const args: Protocol.StopServerAttributes = {
                id: simpleContext.id,
                force: true
            };

            expect(result).equals(ProtocolStubs.status);
            expect(stopStub).calledOnceWith(args);
        });

        test('works without injected context', async () => {
            const result = await handler.stopServer();
            const args: Protocol.StopServerAttributes = {
                id: 'id',
                force: true
            };

            expect(result).equals(ProtocolStubs.status);
            expect(stopStub).calledOnceWith(args);
        });

        test('errors if the server is already stopped', async () => {
            statusStub.returns(ServerState.STOPPED);

            try {
                await handler.stopServer(ProtocolStubs.serverState);
                expect.fail();
            } catch (err) {
                expect(err).equals('The server is already stopped.');
            }
        });

        test('throws any errors coming from the rsp client', async () => {
            stopStub.resolves(ProtocolStubs.errorStatus);

            try {
                await handler.stopServer(ProtocolStubs.serverState);
                expect.fail();
            } catch (err) {
                expect(err).equals(ProtocolStubs.errorStatus.message);
            }
        });
    });

    suite('removeServer', () => {
        let statusStub: sinon.SinonStub;
        let removeStub: sinon.SinonStub;

        setup(() => {
            const serverStateInternal: Protocol.ServerState =  {
                server: ProtocolStubs.serverHandle,
                deployableStates: [],
                publishState: 0,
                state: ServerState.STOPPED
            };

            statusStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(serverStateInternal);
            removeStub = stubs.outgoing.deleteServer.resolves(ProtocolStubs.status);
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
        });

        test('works with injected context', async () => {
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            const result = await handler.removeServer(ProtocolStubs.serverState);
            const args: Protocol.ServerHandle = {
                id: context.id,
                type: context.type
            };

            expect(result).equals(ProtocolStubs.status);
            expect(removeStub).calledOnceWith(args);
        });

        test('works without injected context', async () => {
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            const result = await handler.removeServer();
            const args: Protocol.ServerHandle = {
                id: 'id',
                type: ProtocolStubs.serverType
            };

            expect(result).equals(ProtocolStubs.status);
            expect(removeStub).calledOnceWith(args);
        });

        test('errors if the server is not stopped', async () => {
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            statusStub.returns(ServerState.STARTED);

            try {
                await handler.removeServer(ProtocolStubs.serverState);
                expect.fail();
            } catch (err) {
                expect(err).to.include(ProtocolStubs.serverState.server.id);
            }
        });

        test('throws any errors coming from the rsp client', async () => {
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            removeStub.resolves(ProtocolStubs.errorStatus);

            try {
                await handler.removeServer(ProtocolStubs.serverState);
                expect.fail();
            } catch (err) {
                expect(err).equals(ProtocolStubs.errorStatus.message);
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
            publishState: 0,
            server: ProtocolStubs.serverHandle,
            state: ServerState.STARTED
        };

        setup(() => {
            serverExplorer.serverStatus.set('server', startedState);
            sandbox.stub(serverExplorer.serverStatus, 'get').returns(startedState);
            startStub = stubs.outgoing.startServerAsync.resolves(ProtocolStubs.status);
            stopStub = stubs.outgoingSync.stopServerSync.resolves(ProtocolStubs.status);
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
        });

        test('works with injected context', async () => {
            await handler.restartServer('run', ProtocolStubs.serverState);
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
            await handler.restartServer('run');
            const stopArgs: Protocol.StopServerAttributes = {
                id: 'id',
                force: true
            };
            const startArgs: Protocol.LaunchParameters = {
                mode: 'run',
                params: {
                    id: 'id',
                    serverType: ProtocolStubs.serverType.id,
                    attributes: new Map<string, any>()
                }
            };

            expect(stopStub).calledOnceWith(stopArgs);
            expect(startStub).calledAfter(stopStub);
            expect(startStub).calledOnceWith(startArgs);
        });
    });

    suite('restartInDebugServer', () => {
        let stopStub: sinon.SinonStub;
        const startedState: Protocol.ServerState = {
            deployableStates: [],
            publishState: 0,
            server: ProtocolStubs.serverHandle,
            state: ServerState.STARTED
        };

        setup(() => {
            serverExplorer.serverStatus.set('server', startedState);
            sandbox.stub(serverExplorer.serverStatus, 'get').returns(startedState);
            stopStub = stubs.outgoingSync.stopServerSync.resolves(ProtocolStubs.status);
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
        });

        test('works with injected context', async () => {
            const debugStub = sandbox.stub(handler, 'debugServer' as any).resolves(undefined);
            await handler.restartServer('debug', ProtocolStubs.serverState);
            const stopArgs: Protocol.StopServerAttributes = {
                id: context.id,
                force: true
            };

            expect(stopStub).calledOnceWith(stopArgs);
            expect(debugStub).calledOnceWith(ProtocolStubs.serverState);
            expect(debugStub).calledAfter(stopStub);
        });

        test('works without injected context', async () => {
            const debugStub = sandbox.stub(handler, 'debugServer' as any).resolves(undefined);
            await handler.restartServer('debug');
            const stopArgs: Protocol.StopServerAttributes = {
                id: 'id',
                force: true
            };

            expect(stopStub).calledOnceWith(stopArgs);
            expect(debugStub).calledAfter(stopStub);
            expect(debugStub).calledOnceWith(startedState);
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

function givenServerStarted(sandbox: sinon.SinonSandbox, handler: CommandHandler, responseStub = createServerStartedResponse()) {
    return sandbox.stub(handler, 'startServer')
        .resolves(responseStub);
}

function givenDebugTypeIsSupported(sandbox: sinon.SinonSandbox, handler: CommandHandler) {
    const debugInfo: DebugInfo = new DebugInfo(sandbox.stub() as unknown as Protocol.CommandLineDetails);
    sandbox.stub(DebugInfoProvider, 'retrieve').resolves(debugInfo);
    sandbox.stub(handler, 'checkExtension' as any).resolves(undefined);
}

function createServerStartedResponse() {
    return {
        status: {
            severity: 2, // STARTED
            plugin: undefined,
            code: undefined,
            message: undefined,
            trace: undefined,
            ok: true
        },
        details: {
            cmdLine: undefined,
            workingDir: undefined,
            envp: undefined,
            properties: {
                ['debug.details.type']: 'java',
                ['debug.details.port']: 'javaPort'
            }
        }
    };
}
