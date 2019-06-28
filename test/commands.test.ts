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
import { ServerAPI, ServerInfo } from '../src/rsp/server';
import { ServerExplorer, ServerStateNode } from '../src/serverExplorer';
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

        serverExplorer = ServerExplorer.getInstance();
        handler = new CommandHandler(serverExplorer);

        serverExplorer.RSPServersStatus.set('id', ProtocolStubs.rspProperties);
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

        await handler.activate('type', stubs.client);

        expect(stubs.incoming.onServerAdded).calledOnce;
        expect(stubs.incoming.onServerRemoved).calledOnce;
        expect(stubs.incoming.onServerStateChanged).calledOnce;
        expect(stubs.incoming.onServerProcessOutputAppended).calledOnce;
    });

    suite('startRSP', () => {
        let serverInfo: ServerInfo;
        let rspProvider: ServerAPI;
        setup(() => {
            serverInfo = {
                host: 'localhost',
                port: 8080
            };
            rspProvider = {
                getHost: () => 'localhost',
                getPort: () => 8080,
                onRSPServerStateChanged: () => {},
                startRSP: (stdOut: (data: string) => void, stdErr: (data: string) => void) => Promise.resolve(serverInfo),
                stopRSP: () => Promise.resolve()
            };
        });

        test('error if state is different from STOPPED and UNKNOWN', async () => {
            try {
                await handler.startRSP(ProtocolStubs.rspStateStarted);
                expect.fail();
            } catch (err) {
                expect(err).equals('The RSP server the type is already running.');
            }
        });

        test('check if activateExternalExtension is called with right id', async () => {
            const activateExtStub = sandbox.stub(handler, 'activateExternalExtension' as any).resolves(rspProvider);
            await handler.startRSP(ProtocolStubs.rspState);
            expect(activateExtStub).calledOnceWith('id');
        });

        test('error if activateExternalExtension receive id of an extension not installed', async () => {
            sandbox.stub(vscode.extensions, 'getExtension').resolves(undefined);
            try {
                await handler.startRSP(ProtocolStubs.rspState);
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to retrieve id extension`);
            }
        });

        test('check if setRSPListener is called with right params', async () => {
            sandbox.stub(handler, 'activateExternalExtension' as any).resolves(rspProvider);
            const listenerStub = sandbox.stub(handler, 'setRSPListener').resolves(undefined);
            await handler.startRSP(ProtocolStubs.rspState);
            expect(listenerStub).calledOnceWith('id', rspProvider);
        });

        test('error if rspProvider.startRSP returns not valid response', async () => {
            sandbox.stub(handler, 'activateExternalExtension' as any).resolves(rspProvider);
            rspProvider.startRSP = (stdOut: (data: string) => void, stdErr: (data: string) => void) => Promise.resolve(undefined);
            try {
                await handler.startRSP(ProtocolStubs.rspState);
                expect.fail();
            } catch (err) {
                expect(err).equals('Failed to start the the type RSP server');
            }
        });

        test('check refreshTree is called once', async () => {
            const refreshTreeStub = sandbox.stub(serverExplorer, 'refreshTree');
            sandbox.stub(handler, 'activateExternalExtension' as any).resolves(rspProvider);
            await handler.startRSP(ProtocolStubs.rspState);
            expect(refreshTreeStub).calledOnce;
        });
    });

    suite('stopRSP', async () => {

        let serverInfo: ServerInfo;
        let rspProvider: ServerAPI;
        setup(() => {
            serverInfo = {
                host: 'localhost',
                port: 8080
            };
            rspProvider = {
                getHost: () => 'localhost',
                getPort: () => 8080,
                onRSPServerStateChanged: () => {},
                startRSP: (stdOut: (data: string) => void, stdErr: (data: string) => void) => Promise.resolve(serverInfo),
                stopRSP: () => Promise.resolve()
            };
        });

        test('error if state is STOPPED or UNKNOWN', async () => {
            try {
                await handler.stopRSP(false, ProtocolStubs.rspState);
                expect.fail();
            } catch (err) {
                expect(err).equals('The RSP server the type is already stopped.');
            }
        });

        test('check if getClient is called with right param', async () => {
            const getClientStub = sandbox.stub(serverExplorer, 'getClientByRSP').returns(stubs.client);
            await handler.stopRSP(false, ProtocolStubs.rspStateStarted);
            expect(getClientStub).calledOnceWith('id');
        });

        test('error if rsp\'s client is undefined', async () => {
            sandbox.stub(serverExplorer, 'getClientByRSP').returns(undefined);
            try {
                await handler.stopRSP(false, ProtocolStubs.rspStateStarted);
                expect.fail();
            } catch (err) {
                expect(err).equals('Failed to contact the RSP server the type.');
            }
        });

        test('check if updateState is called twice if not forced or forced and no error occured', async () => {
            const updateStub = sandbox.stub(serverExplorer, 'updateRSPServer');
            sandbox.stub(serverExplorer, 'getClientByRSP').returns(stubs.client);
            await handler.stopRSP(false, ProtocolStubs.rspStateStarted);
            expect(updateStub).calledTwice;
        });

        test('check that shutdown server is called if stop is not forced', async () => {
            sandbox.stub(serverExplorer, 'getClientByRSP').returns(stubs.client);
            await handler.stopRSP(false, ProtocolStubs.rspStateStarted);
            expect(stubs.clientStub.shutdownServer).calledOnce;
        });

        test('check if external rsp provider is called if stop is forced', async () => {
            const activateExtStub = sandbox.stub(handler, 'activateExternalExtension' as any).resolves(rspProvider);
            await handler.stopRSP(true, ProtocolStubs.rspStateStarted);
            expect(activateExtStub).calledOnceWith('id');
        });

        test('error if external rsp provider stopRSP method returns an error', async () => {
            rspProvider.stopRSP = () => Promise.reject('error');
            sandbox.stub(handler, 'activateExternalExtension' as any).resolves(rspProvider);
            try {
                await handler.stopRSP(true, ProtocolStubs.rspStateStarted);
                expect.fail();
            } catch (err) {
                expect(err).equals('Failed to terminate the type - error');
            }
        });

        test('check if updateState is called three times if forced and error occured', async () => {
            const updateStub = sandbox.stub(serverExplorer, 'updateRSPServer');
            rspProvider.stopRSP = () => Promise.reject('error');
            sandbox.stub(handler, 'activateExternalExtension' as any).resolves(rspProvider);
            try {
                await handler.stopRSP(true, ProtocolStubs.rspStateStarted);
                expect(updateStub).calledThrice;
                expect.fail();
            } catch (err) {
                expect(err).equals('Failed to terminate the type - error');
            }
        });

        test('check if disposeRSp is called with right param', async () => {
            const disposeRSPStub = sandbox.stub(serverExplorer, 'disposeRSPProperties');
            sandbox.stub(handler, 'activateExternalExtension' as any).resolves(rspProvider);
            await handler.stopRSP(true, ProtocolStubs.rspStateStarted);
            expect(disposeRSPStub).calledOnceWith('id');
        });

    });

    suite('startServer', () => {
        let statusStub: sinon.SinonStub;
        let startStub: sinon.SinonStub;

        setup(() => {
            statusStub = sandbox.stub(serverExplorer, 'getServerStateById').returns(ProtocolStubs.unknownServerState);
            sandbox.stub(serverExplorer, 'getClientByRSP').returns(stubs.client);
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
            sandbox.stub(handler, 'selectRSP' as any).resolves({id: 'id', label: 'rsp'});
            sandbox.stub(handler, 'selectServer' as any).resolves('id');
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
            startStub = sandbox.stub(serverExplorer, 'getServerStateById').returns(ProtocolStubs.unknownServerState);
            sandbox.stub(serverExplorer, 'getClientByRSP').returns(stubs.client);
            startStub = sandbox.stub().resolves(response);
            stubs.outgoing.startServerAsync = startStub;
        });

        test('display error if no debugInfo passed', async () => {
            sandbox.stub(DebugInfoProvider, 'retrieve').resolves(undefined);
            try {
                await handler.debugServer(ProtocolStubs.unknownServerState);
                expect.fail();
            } catch (err) {
                expect(err).equals('Could not find server debug info.');
            }
        });

        test('check if retrieve method called with right params', async () => {
            const debugInfo: DebugInfo = new DebugInfo(cmdDetails);
            sandbox.stub(debugInfo, 'isJavaType').returns(true);
            const retrieveStub = sandbox.stub(DebugInfoProvider, 'retrieve').callsFake((serverHandle, client) => {
                return Promise.resolve(debugInfo);
            });
            try {
                await handler.debugServer(ProtocolStubs.unknownServerState);
                expect(retrieveStub).calledOnceWith(ProtocolStubs.serverHandle, stubs.client);
                expect.fail();
            } catch (err) {
                expect(err).equals('Could not find server debug info.');
            }
        });

        test('display error if language is not supported', async () => {
            // given
            stubs.outgoing.getLaunchCommand = sandbox.stub().resolves(cmdDetails);
            const debugInfo: DebugInfo = new DebugInfo(cmdDetails as Protocol.CommandLineDetails);
            sandbox.stub(debugInfo, 'isJavaType').returns(false);
            sandbox.stub(DebugInfoProvider, 'retrieve').resolves(debugInfo);
            // when
            try {
                await handler.debugServer(ProtocolStubs.unknownServerState);
            } catch (err) {
                expect(err).equals(`Vscode-Adapters doesn't support debugging with c# language at this time.`);
            }
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
            sandbox.stub(handler, 'selectRSP' as any).resolves({id: 'id', label: 'rsp'});
            sandbox.stub(handler, 'selectServer' as any).resolves('id');
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
            statusStub = sandbox.stub(serverExplorer, 'getServerStateById').returns(ProtocolStubs.startedServerState);
            sandbox.stub(serverExplorer, 'getClientByRSP').returns(stubs.client);
            stopStub = stubs.outgoing.stopServerAsync = sandbox.stub().resolves(ProtocolStubs.okStatus);
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
        });

        test('works with injected context', async () => {
            const result = await handler.stopServer(false, ProtocolStubs.startedServerState);
            const args: Protocol.StopServerAttributes = {
                id: ProtocolStubs.serverHandle.id,
                force: true
            };

            expect(result).equals(ProtocolStubs.okStatus);
            expect(stopStub).calledOnceWith(args);
        });

        test('works without injected context', async () => {
            sandbox.stub(handler, 'selectRSP' as any).resolves({id: 'id', label: 'rsp'});
            sandbox.stub(handler, 'selectServer' as any).resolves('id');
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
            const serverStateInternal: ServerStateNode =  {
                server: ProtocolStubs.serverHandle,
                deployableStates: [],
                publishState: 0,
                runMode: ServerState.RUN_MODE_RUN,
                state: ServerState.STARTING,
                rsp: 'id'
            };

            statusStub = sandbox.stub(serverExplorer, 'getServerStateById').returns(serverStateInternal);
            sandbox.stub(serverExplorer, 'getClientByRSP').returns(stubs.client);
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
            sandbox.stub(handler, 'selectRSP' as any).resolves({id: 'id', label: 'rsp'});
            sandbox.stub(handler, 'selectServer' as any).resolves('id');
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
            const serverStateInternal: ServerStateNode =  {
                server: ProtocolStubs.serverHandle,
                deployableStates: [],
                publishState: 0,
                runMode: ServerState.RUN_MODE_RUN,
                state: ServerState.STOPPED,
                rsp: 'id'
            };

            statusStub = sandbox.stub(serverExplorer, 'getServerStateById').returns(serverStateInternal);
            sandbox.stub(serverExplorer, 'getClientByRSP').returns(stubs.client);
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
            sandbox.stub(handler, 'selectRSP' as any).resolves({id: 'id', label: 'rsp'});
            sandbox.stub(handler, 'selectServer' as any).resolves('id');
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
            sandbox.stub(serverExplorer, 'getClientByRSP').returns(stubs.client);
            stopStub = sandbox.stub(handler, 'stopServer').resolves(ProtocolStubs.okStatus);
            startStub = sandbox.stub(handler, 'startServer').resolves(ProtocolStubs.okStatus);
            sandbox.stub(vscode.window, 'showQuickPick').resolves(ProtocolStubs.serverHandle.id);
        });

        test('should restart with given server', async () => {
            sandbox.stub(serverExplorer, 'getServerStateById').returns(ProtocolStubs.startedServerState);
            // when
            await handler.restartServer('run', ProtocolStubs.startedServerState);

            // then
            expect(stopStub).calledOnceWith(false, ProtocolStubs.startedServerState);
            expect(startStub).calledAfter(stopStub);
            expect(startStub).calledOnceWith('run', ProtocolStubs.startedServerState);
        });

        test('should restart without given but prompted server', async () => {
            sandbox.stub(handler, 'selectRSP' as any).resolves({id: 'id', label: 'rsp'});
            sandbox.stub(handler, 'selectServer' as any).resolves('id');
            sandbox.stub(serverExplorer, 'getServerStateById').returns(ProtocolStubs.startedServerState);

            // when
            await handler.restartServer('run');

            // then
            expect(stopStub).calledOnceWith(false, ProtocolStubs.startedServerState);
            expect(startStub).calledAfter(stopStub);
            expect(startStub).calledOnceWith('run', ProtocolStubs.startedServerState);
        });
    });

    suite('restartServerInDebug', () => {
        let stopStub: sinon.SinonStub;
        let debugStub: sinon.SinonStub;

        setup(() => {
            stopStub = sandbox.stub(handler, 'stopServer').resolves(ProtocolStubs.okStatus);
            debugStub = sandbox.stub(handler, 'debugServer').resolves(ProtocolStubs.okStatus);
            stubs.outgoing.getLaunchCommand = sandbox.stub().resolves(ProtocolStubs.javaCommandLine);
            sandbox.stub(vscode.window, 'showQuickPick').resolves(ProtocolStubs.serverHandle.id);
            sandbox.stub(handler, 'checkExtension' as any).resolves(undefined);
        });

        test('should restart with given server', async () => {
            // when
            await handler.restartServer('debug', ProtocolStubs.startedServerState);

            // then
            expect(stopStub).calledOnceWith(false, ProtocolStubs.startedServerState);
            expect(debugStub).calledAfter(stopStub);
            expect(debugStub).calledOnceWith(ProtocolStubs.startedServerState);
        });

        test('should restart without given but prompted server', async () => {
            sandbox.stub(handler, 'selectRSP' as any).resolves({id: 'id', label: 'rsp'});
            sandbox.stub(handler, 'selectServer' as any).resolves('id');
            sandbox.stub(serverExplorer, 'getServerStateById').returns(ProtocolStubs.startedServerState);

            // when
            await handler.restartServer('debug');

            // then
            expect(stopStub).calledOnceWith(false, ProtocolStubs.startedServerState);
            expect(debugStub).calledAfter(stopStub);
            expect(debugStub).calledOnceWith(ProtocolStubs.startedServerState);
        });
    });

    suite('addLocation', () => {

        test('calls addLocation from server explorer', async () => {
            sandbox.stub(serverExplorer, 'addLocation').resolves(undefined);
            await handler.addLocation('id');
            expect(serverExplorer.addLocation).calledOnce;
        });

        test('errors if server explorer is not initialized', async () => {
            const nullHandler = new CommandHandler(null);

            try {
                await nullHandler.addLocation('id');
                expect.fail();
            } catch (err) {
                expect(err).equals('Runtime Server Protocol (RSP) Server is starting, please try again later.');
            }
        });
    });

    suite('infoServer', () => {

        test('errors if server explorer is not initialized', async () => {
            const nullHandler = new CommandHandler(null);

            try {
                await nullHandler.infoServer(undefined);
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
