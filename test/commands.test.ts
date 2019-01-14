import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as vscode from 'vscode';
import { ServersViewTreeDataProvider } from '../src/serverExplorer';
import { RSPClient, ServerState, Protocol } from 'rsp-client';
import { CommandHandler } from '../src/extensionApi';

const expect = chai.expect;
chai.use(sinonChai);

suite('Command Handler', () => {
    let sandbox: sinon.SinonSandbox;
    let client: RSPClient;
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
        id: 'cid'
    };
    const context = {
        id: 'cid',
        type: serverType
    };

    setup(() => {
        sandbox = sinon.createSandbox();
        client = new RSPClient('localhost', 27155);
        sandbox.stub(client, 'connect').resolves();
        sandbox.stub(client, 'getServerHandles').resolves([]);
        serverExplorer = new ServersViewTreeDataProvider(client);
        handler = new CommandHandler(serverExplorer, client);
        sandbox.stub(serverExplorer);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('activate connects to the server', async () => {
        await handler.activate();

        expect(client.connect).calledOnce;
    });

    test('activate registers event listeners', async () => {
        sandbox.spy(client, 'onServerAdded');
        sandbox.spy(client, 'onServerRemoved');
        sandbox.spy(client, 'onServerStateChange');
        sandbox.spy(client, 'onServerOutputAppended');

        await handler.activate();

        expect(client.onServerAdded).calledOnce;
        expect(client.onServerRemoved).calledOnce;
        expect(client.onServerStateChange).calledOnce;
        expect(client.onServerOutputAppended).calledOnce;
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
            statusStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(ServerState.STOPPED);
            startStub = sandbox.stub(client, 'startServerAsync').resolves(response);
        });

        test('works with injected context', async () => {
            const result = await handler.startServer('run', context);
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
            sandbox.stub(serverExplorer.serverStatus, 'get').returns(serverHandle);

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
                await handler.startServer('run', context);
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
                await handler.startServer('run', context);
                expect.fail();
            } catch (err) {
                expect(err).equals(errorStatus.message);
            }
        });
    });

    suite('stopServer', () => {
        let statusStub: sinon.SinonStub;
        let stopStub: sinon.SinonStub;

        setup(() => {
            statusStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(ServerState.STARTED);
            stopStub = sandbox.stub(client, 'stopServerAsync').resolves(status);
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
        });

        test('works with injected context', async () => {
            const result = await handler.stopServer(simpleContext);
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
                await handler.stopServer(simpleContext);
                expect.fail();
            } catch (err) {
                expect(err).equals('The server is already stopped.');
            }
        });

        test('throws any errors coming from the rsp client', async () => {
            stopStub.resolves(errorStatus);

            try {
                await handler.stopServer(simpleContext);
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
            statusStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(ServerState.STOPPED);
            removeStub = sandbox.stub(client, 'deleteServerAsync').resolves(status);
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
        });

        test('works with injected context', async () => {
            const result = await handler.removeServer(context);
            const args: Protocol.ServerHandle = {
                id: context.id,
                type: context.type
            };

            expect(result).equals(status);
            expect(removeStub).calledOnceWith(args);
        });

        test('works without injected context', async () => {
            sandbox.stub(serverExplorer.serverStatus, 'get').returns(serverHandle);
            const result = await handler.removeServer();
            const args: Protocol.ServerHandle = {
                id: 'id',
                type: serverType
            };

            expect(result).equals(status);
            expect(removeStub).calledOnceWith(args);
        });

        test('errors if the server is not stopped', async () => {
            statusStub.returns(ServerState.STARTED);

            try {
                await handler.removeServer(context);
                expect.fail();
            } catch (err) {
                expect(err).equals('Please stop the server before removing it.');
            }
        });

        test('throws any errors coming from the rsp client', async () => {
            removeStub.resolves(errorStatus);

            try {
                await handler.removeServer(context);
                expect.fail();
            } catch (err) {
                expect(err).equals(errorStatus.message);
            }
        });
    });

    suite('restartServer', () => {
        let startStub: sinon.SinonStub;
        let stopStub: sinon.SinonStub;

        setup(() => {
            sandbox.stub(serverExplorer.serverStatus, 'get').returns(ServerState.STARTED);
            startStub = sandbox.stub(client, 'startServerAsync').resolves(status);
            stopStub = sandbox.stub(client, 'stopServerSync').resolves(status);
            sandbox.stub(vscode.window, 'showQuickPick').resolves('id');
        });

        test('works with injected context', async () => {
            await handler.restartServer(context);
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
            sandbox.stub(serverExplorer.serverStatus, 'get').returns(serverHandle);
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
            await handler.addLocation();

            expect(serverExplorer.addLocation).calledOnce;
        });

        test('errors if server explorer is not initialized', async () => {
            const nullHandler = new CommandHandler(null, client);

            try {
                await nullHandler.addLocation();
                expect.fail();
            } catch (err) {
                expect(err).equals('Stack Protocol Server is starting, please try again later.');
            }
        });
    });
});