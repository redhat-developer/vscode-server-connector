/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as chaipromise from 'chai-as-promised';
import { ClientStubs } from './clientstubs';
import { DebugInfo } from '../src/debug/debugInfo';
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
chai.use(chaipromise);

suite('Command Handler', () => {
    let sandbox: sinon.SinonSandbox;
    let sandboxDebug: sinon.SinonSandbox;
    let stubs: ClientStubs;
    let handler: CommandHandler;
    let serverExplorer: ServerExplorer;

    setup(() => {
        sandbox = sinon.createSandbox();
        sandboxDebug = sinon.createSandbox();

        stubs = new ClientStubs(sandbox);
        stubs.outgoing.getServerHandles = sandbox.stub().resolves([ProtocolStubs.serverHandle]);
        stubs.outgoing.getServerState = sandbox.stub().resolves(ProtocolStubs.unknownServerState);

        serverExplorer = new ServerExplorer(stubs.client);
        handler = new CommandHandler(serverExplorer, stubs.client);

        serverExplorer.serverStatus.set('server', ProtocolStubs.unknownServerState);
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

        setup(() => {
            statusStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(ProtocolStubs.unknownServerState);
            startStub = sandbox.stub().resolves(ProtocolStubs.okStartServerResponse);
            stubs.outgoing.startServerAsync = startStub;
        });

        test('works with injected context', async () => {
            const result = await handler.startServer('run', ProtocolStubs.unknownServerState);
            const args: Protocol.LaunchParameters = {
                mode: 'run',
                params: {
                    serverType: ProtocolStubs.serverHandle.type.id,
                    id: ProtocolStubs.serverHandle.id,
                    attributes: new Map<string, any>()
                }
            };

            expect(result).equals(ProtocolStubs.okStartServerResponse);
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

            expect(result).equals(ProtocolStubs.okStartServerResponse);
            expect(startStub).calledOnceWith(args);
        });

        test('errors if the server is already running', async () => {
            statusStub.returns(ServerState.STARTED);

            try {
                await handler.startServer('run', ProtocolStubs.unknownServerState);
                expect.fail();
            } catch (err) {
                expect(err).equals('The server is already running.');
            }
        });

        test('throws any errors coming from the rsp client', async () => {
            const result: Protocol.StartServerResponse = {
                details: ProtocolStubs.cmdDetails,
                status: ProtocolStubs.errorStatus
            };
            startStub.resolves(result);

            try {
                await handler.startServer('run', ProtocolStubs.unknownServerState);
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
            status: ProtocolStubs.okStatus
        };

        setup(() => {
            startStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(ProtocolStubs.unknownServerState);
            startStub = sandbox.stub().resolves(response);
            stubs.outgoing.startServerAsync = startStub;
        });

        test('display error if no extension found', async () => {
            const stubM = sinon.stub(handler, 'checkExtension' as any);
            stubM.resolves('Debugger for Java extension is required. Install/Enable it before proceeding.');
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
            await handler.debugServer(ProtocolStubs.unknownServerState);
            sinon.assert.calledOnce(showErrorMessageStub);
        });

        test('display error if language is not supported', async () => {
            // given
            const debugInfo: DebugInfo = new DebugInfo(sandbox.stub() as unknown as Protocol.CommandLineDetails);
            sandbox.stub(debugInfo, 'isJavaType').returns(false);
            sandbox.stub(DebugInfoProvider, 'retrieve').resolves(debugInfo);
            const startServerStub = givenServerStarted(sandbox, handler);
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
            // when
            await handler.debugServer(ProtocolStubs.unknownServerState);
            // then
            sandbox.assert.calledOnce(showErrorMessageStub);
            sandbox.assert.notCalled(startServerStub);
        });

        test('starts server & debugging with given server', async () => {
            // given
            givenDebugTypeIsSupported(sandbox, handler);
            const startServerStub = givenServerStarted(sandbox, handler);
            const startDebuggingStub = sandbox.stub(vscode.debug, 'startDebugging');
            givenProcessOutput(sandbox, stubs);
            // when
            await handler.debugServer(ProtocolStubs.unknownServerState);
            // then
            sandbox.assert.calledOnce(startServerStub);
            sandbox.assert.calledOnce(startDebuggingStub);
        });

        test('starts server & debugging without given but prompted server', async () => {
            // given
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
            givenDebugTypeIsSupported(sandbox, handler);
            const startServerStub = givenServerStarted(sandbox, handler);
            const startDebuggingStub = sandbox.stub(vscode.debug, 'startDebugging');
            givenProcessOutput(sandbox, stubs);
            // when
            await handler.debugServer(undefined);
            // then
            sandbox.assert.calledOnce(startServerStub);
            sandbox.assert.calledOnce(startDebuggingStub);
        });

    });

    suite('stopServer', () => {
        let statusStub: sinon.SinonStub;
        let stopStub: sinon.SinonStub;

        setup(() => {
            statusStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(ProtocolStubs.startedServerState);
            stopStub = stubs.outgoing.stopServerAsync = sandbox.stub().resolves(ProtocolStubs.okStatus);
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
        });

        test('works with injected context', async () => {
            const result = await handler.stopServer(false, ProtocolStubs.unknownServerState);
            const args: Protocol.StopServerAttributes = {
                id: ProtocolStubs.serverHandle.id,
                force: true
            };

            expect(result).equals(ProtocolStubs.okStatus);
            expect(stopStub).calledOnceWith(args);
        });

        test('works without injected context', async () => {
            const result = await handler.stopServer(false);
            const args: Protocol.StopServerAttributes = {
                id: 'id',
                force: true
            };

            expect(result).equals(ProtocolStubs.okStatus);
            expect(stopStub).calledOnceWith(args);
        });

        test('errors if the server is already stopped', async () => {
            statusStub.returns(ServerState.STOPPED);

            try {
                await handler.stopServer(false, ProtocolStubs.stoppedServerState);
                expect.fail();
            } catch (err) {
                expect(err).equals('The server is already stopped.');
            }
        });

        test('throws any errors coming from the rsp client', async () => {
            stopStub.resolves(ProtocolStubs.errorStatus);

            try {
                await handler.stopServer(true, ProtocolStubs.startedServerState);
                expect.fail();
            } catch (err) {
                expect(err).equals('The server is already stopped.');
            }
        });
    });

    suite('terminateServer', () => {
        let statusStub: sinon.SinonStub;
        let stopStub: sinon.SinonStub;

        setup(() => {
            const serverStateInternal: Protocol.ServerState =  {
                server: ProtocolStubs.serverHandle,
                deployableStates: [],
                publishState: 0,
                runMode: ServerState.RUN_MODE_RUN,
                state: ServerState.STARTING
            };

            statusStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(serverStateInternal);
            stopStub = stubs.outgoing.stopServerAsync.resolves(ProtocolStubs.okStatus);
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
        });

        test('works with injected context', async () => {
            const result = await handler.stopServer(true, ProtocolStubs.startedServerState);
            const args: Protocol.StopServerAttributes = {
                id: ProtocolStubs.startedServerState.server.id,
                force: true
            };

            expect(result).equals(ProtocolStubs.okStatus);
            expect(stopStub).calledOnceWith(args);
        });

        test('works without injected context', async () => {
            const result = await handler.stopServer(true);
            const args: Protocol.StopServerAttributes = {
                id: 'id',
                force: true
            };

            expect(result).equals(ProtocolStubs.okStatus);
            expect(stopStub).calledOnceWith(args);
        });

        test('errors if the server is already stopped', async () => {
            statusStub.returns(ServerState.STOPPED);

            try {
                await handler.stopServer(false, ProtocolStubs.stoppedServerState);
                expect.fail();
            } catch (err) {
                expect(err).equals('The server is already stopped.');
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
                runMode: ServerState.RUN_MODE_RUN,
                state: ServerState.STOPPED
            };

            statusStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(serverStateInternal);
            removeStub = stubs.outgoing.deleteServer.resolves(ProtocolStubs.okStatus);
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
        });

        test('works with injected context', async () => {
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            const result = await handler.removeServer(ProtocolStubs.unknownServerState);
            const args: Protocol.ServerHandle = {
                id: ProtocolStubs.serverHandle.id,
                type: ProtocolStubs.serverHandle.type
            };

            expect(result).equals(ProtocolStubs.okStatus);
            expect(removeStub).calledOnceWith(args);
        });

        test('works without injected context', async () => {
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            const result = await handler.removeServer();
            const args: Protocol.ServerHandle = {
                id: 'id',
                type: ProtocolStubs.serverType
            };

            expect(result).equals(ProtocolStubs.okStatus);
            expect(removeStub).calledOnceWith(args);
        });

        test('errors if the server is not stopped', async () => {
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            statusStub.returns(ServerState.STARTED);

            try {
                await handler.removeServer(ProtocolStubs.unknownServerState);
                expect.fail();
            } catch (err) {
                expect(err).to.include(ProtocolStubs.unknownServerState.server.id);
            }
        });

        test('throws any errors coming from the rsp client', async () => {
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            removeStub.resolves(ProtocolStubs.errorStatus);

            try {
                await handler.removeServer(ProtocolStubs.unknownServerState);
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

        setup(() => {
            serverExplorer.serverStatus.set(ProtocolStubs.startedServerState.server.id, ProtocolStubs.startedServerState);
            stopStub = stubs.outgoing.stopServerAsync = sandbox.stub().callsFake(() => {
                // set server to stopped state if stopServer is called
                serverExplorer.serverStatus.set(ProtocolStubs.stoppedServerState.server.id, ProtocolStubs.stoppedServerState);
                return ProtocolStubs.okStatus;
            });
            startStub = stubs.outgoing.startServerAsync = sandbox.stub().resolves(ProtocolStubs.okStartServerResponse);
            sandbox.stub(vscode.window, 'showQuickPick').resolves(ProtocolStubs.serverHandle.id);
        });

        test('should restart with given server', async () => {
            // when
            await handler.restartServer('run', ProtocolStubs.startedServerState);

            // then
            const stopArgs: Protocol.StopServerAttributes = {
                id: ProtocolStubs.startedServerState.server.id,
                force: true
            };
            const startArgs: Protocol.LaunchParameters = {
                mode: 'run',
                params: {
                    id: ProtocolStubs.startedServerState.server.id,
                    serverType: ProtocolStubs.startedServerState.server.type.id,
                    attributes: new Map<string, any>()
                }
            };
            expect(stopStub).calledOnceWith(stopArgs);
            expect(startStub).calledAfter(stopStub);
            expect(startStub).calledOnceWith(startArgs);
        });

        test('should restart without given but prompted server', async () => {
            // when
            await handler.restartServer('run');

            // then
            const stopArgs: Protocol.StopServerAttributes = {
                id: ProtocolStubs.startedServerState.server.id,
                force: true
            };
            const startArgs: Protocol.LaunchParameters = {
                mode: 'run',
                params: {
                    id: ProtocolStubs.startedServerState.server.id,
                    serverType: ProtocolStubs.startedServerState.server.type.id,
                    attributes: new Map<string, any>()
                }
            };
            expect(stopStub).calledOnceWith(stopArgs);
            expect(startStub).calledAfter(stopStub);
            expect(startStub).calledOnceWith(startArgs);
        });
    });

    suite('restartServerInDebug', () => {
        let stopStub: sinon.SinonStub;
        let debugStub: sinon.SinonStub;

        setup(() => {
            serverExplorer.serverStatus.set(ProtocolStubs.startedServerState.server.id, ProtocolStubs.startedServerState);
            stopStub = stubs.outgoing.stopServerAsync = sandbox.stub().callsFake(() => {
                // set server to stopped state if stopServer is called
                serverExplorer.serverStatus.set(ProtocolStubs.stoppedServerState.server.id, ProtocolStubs.stoppedServerState);
                return ProtocolStubs.okStatus;
            });
            debugStub = stubs.outgoing.startServerAsync = sandbox.stub().resolves(ProtocolStubs.okStartServerResponse);
            stubs.outgoing.getLaunchCommand = sandbox.stub().resolves(ProtocolStubs.javaCommandLine);
            sandbox.stub(vscode.window, 'showQuickPick').resolves(ProtocolStubs.serverHandle.id);
            sandbox.stub(handler, 'checkExtension' as any).resolves(undefined);
        });

        test('should restart with given server', async () => {
            // when
            await handler.restartServer('debug', ProtocolStubs.unknownServerState);

            // then
            const stopArgs: Protocol.StopServerAttributes = {
                id: ProtocolStubs.serverHandle.id,
                force: true
            };
            const startArgs: Protocol.LaunchParameters = {
                mode: 'debug',
                params: {
                    id: ProtocolStubs.serverHandle.id,
                    serverType: ProtocolStubs.serverType.id,
                    attributes: new Map<string, any>()
                }
            };
            expect(stopStub).calledOnceWith(stopArgs);
            expect(debugStub).calledOnceWith(startArgs);
            expect(debugStub).calledAfter(stopStub);
        });

        test('should restart without given but prompted server', async () => {
            // when
            await handler.restartServer('debug');

            // then
            const stopArgs: Protocol.StopServerAttributes = {
                id: ProtocolStubs.serverHandle.id,
                force: true
            };
            const startArgs: Protocol.LaunchParameters = {
                mode: 'debug',
                params: {
                    id: ProtocolStubs.serverHandle.id,
                    serverType: ProtocolStubs.serverType.id,
                    attributes: new Map<string, any>()
                }
            };
            expect(stopStub).calledOnceWith(stopArgs);
            expect(debugStub).calledOnceWith(startArgs);
            expect(debugStub).calledAfter(stopStub);
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

function givenProcessOutput(sandbox: sinon.SinonSandbox, stubs: ClientStubs) {
    stubs.incoming.onServerProcessOutputAppended = sandbox.stub().callsFake((listener: (arg: Protocol.ServerProcessOutput) => void) => {
        // call listeners that's being registered with fake output
        listener({
            server: ProtocolStubs.serverHandle,
            processId: 'papa smurf',
            streamType: 1,
            text: 'Listening for transport dt_socket'
        });
    });

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
