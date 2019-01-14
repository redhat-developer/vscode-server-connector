import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { ServersViewTreeDataProvider } from '../src/serverExplorer';
import { RSPClient, Protocol } from 'rsp-client';
import { EventEmitter, window, Uri, OutputChannel } from 'vscode';
import * as path from 'path';

const expect = chai.expect;
chai.use(sinonChai);

suite('Server explorer', () => {

    let sandbox: sinon.SinonSandbox;
    let getStub: sinon.SinonStub;
    const clientStub: RSPClient = new RSPClient('somehost', 8080);
    let serverExplorer: ServersViewTreeDataProvider;

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(clientStub, 'connect').resolves();
        sandbox.stub(clientStub, 'getServerHandles').resolves([]);
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        getStub = sandbox.stub(serverExplorer.serverOutputChannels, 'get').returns(fakeChannel);
    });

    teardown(() => {
        sandbox.restore();
    });

    const serverType: Protocol.ServerType = {
        description: 'a type',
        id: 'type',
        visibleName: 'the type'
    };

    const serverHandle: Protocol.ServerHandle = {
        id: 'id',
        type: serverType
    };

    const ProcessOutput: Protocol.ServerProcessOutput = {
        processId: 'process id',
        server: serverHandle,
        streamType: 0,
        text: 'the type'
    };

    const fakeChannel: OutputChannel = {
        append: () => {},
        show: () => {},
        clear: () => {},
        dispose: () => {},
        appendLine: () => {},
        hide: () => {},
        name: 'fake'
    };

    test('insertServer call should add server to tree data model', () => {
        const refreshStub = sandbox.stub(serverExplorer, 'refresh');
        serverExplorer.insertServer(serverHandle);
        const children = serverExplorer.getChildren();

        expect(refreshStub).calledOnce;
        expect(children).deep.equals([serverHandle]);
    });

    test('removeServer call should remove server from tree data model', () => {
        const children = serverExplorer.getChildren();
        sandbox.stub(serverExplorer, 'refresh');
        serverExplorer.insertServer(serverHandle);
        serverExplorer.removeServer(serverHandle);

        expect(getStub).calledOnce;
        expect(children).empty;
    });

    test('showOutput call should show servers output channel', () => {
        const spy = sandbox.spy(fakeChannel, 'show');
        serverExplorer.showOutput(serverHandle);

        expect(getStub).calledOnce;
        expect(spy).calledOnce;
    });

    test('addServerOutput call should show ServerOutput channel', () => {
        const appendSpy = sandbox.spy(fakeChannel, 'append');
        serverExplorer.addServerOutput(ProcessOutput);

        expect(getStub).calledOnce;
        expect(appendSpy).calledOnce;
    });

    test('refresh should trigger getChildren call for root node', () => {
        const fireStub = sandbox.stub(EventEmitter.prototype, 'fire');
        serverExplorer.refresh(serverHandle);

        expect(fireStub).calledOnceWith(serverHandle);
    });

    suite('updateServer', () => {

        let getServersStub: sinon.SinonStub;
        let setStatusStub: sinon.SinonStub;

        const stateChangeUnknown: Protocol.ServerState = {
            server: serverHandle,
            state: 0,
            publishState: 1,
            deployableStates: []
        };
        const stateChangeStarting: Protocol.ServerState = {
            server: serverHandle,
            state: 1,
            publishState: 1,
            deployableStates: []
        };
        const stateChangeStarted: Protocol.ServerState = {
            server: serverHandle,
            state: 2,
            publishState: 1,
            deployableStates: []
        };
        const stateChangeStopping: Protocol.ServerState = {
            server: serverHandle,
            state: 3,
            publishState: 1,
            deployableStates: []
        };
        const stateChangeStopped: Protocol.ServerState = {
            server: serverHandle,
            state: 4,
            publishState: 1,
            deployableStates: []
        };

        const serverStop = {
            collapsibleState: 0,
            label: `id:the type(Stopped)`,
            contextValue: 'Stopped',
            iconPath: Uri.file(path.join(__dirname, '../../images/server-light.png'))
        };

        const serverStart = {
            collapsibleState: 0,
            label: 'id:the type(Started)',
            contextValue: 'Started',
            iconPath: Uri.file(path.join(__dirname, '../../images/server-light.png'))
        };

        const serverUnknown = {
            collapsibleState: 0,
            label: 'id:the type(Unknown)',
            contextValue: 'Unknown',
            iconPath: Uri.file(path.join(__dirname, '../../images/server-light.png'))
        };

        setup(() => {
            serverExplorer.serverStatus =  new Map<string, Protocol.ServerHandle>([['server', serverHandle]]);
            getServersStub = sandbox.stub(serverExplorer.serverStatus, 'get').returns(serverHandle);
            setStatusStub = sandbox.stub(serverExplorer.serverStatus, 'set');
        });

        test('call should update server state to received in state change event (Stopped)', () => {
            sandbox.stub(serverExplorer.runStateEnum, 'get').returns('Stopped');
            const children = serverExplorer.getChildren();
            const treeItem = serverExplorer.getTreeItem(serverHandle);

            serverExplorer.updateServer(stateChangeStopping);
            serverExplorer.refresh();
            serverExplorer.updateServer(stateChangeStopped);

            expect(getServersStub).calledTwice;
            expect(setStatusStub).calledTwice;
            expect(getStub).calledTwice;
            expect(children).deep.equals([serverHandle]);
            expect(treeItem).deep.equals(serverStop);
        });

        test('call should update server state to received in state change event (Started)', () => {
            sandbox.stub(serverExplorer.runStateEnum, 'get').returns('Started');
            const children = serverExplorer.getChildren();
            const treeItem = serverExplorer.getTreeItem(serverHandle);

            serverExplorer.updateServer(stateChangeStarting);
            serverExplorer.refresh();
            serverExplorer.updateServer(stateChangeStarted);

            expect(getServersStub).calledTwice;
            expect(setStatusStub).calledTwice;
            expect(getStub).calledTwice;
            expect(children).deep.equals([serverHandle]);
            expect(treeItem).deep.equals(serverStart);
        });

        test('call should update server state to received in state change event (Unknown)', () => {
            sandbox.stub(serverExplorer.runStateEnum, 'get').returns('Unknown');
            const children = serverExplorer.getChildren();
            const treeItem = serverExplorer.getTreeItem(serverHandle);

            serverExplorer.updateServer(stateChangeUnknown);

            expect(getServersStub).calledOnce;
            expect(setStatusStub).calledOnce;
            expect(getStub).calledOnce;
            expect(children).deep.equals([serverHandle]);
            expect(treeItem).deep.equals(serverUnknown);
        });
    });

    suite('addLocation', () => {
        let findServerStub: sinon.SinonStub;
        let showOpenDialogStub: sinon.SinonStub;

        const serverBean: Protocol.ServerBean = {
            fullVersion: 'version',
            location: 'path',
            name: 'EAP',
            serverAdapterTypeId: 'org.jboss',
            specificType: 'EAP',
            typeCategory: 'EAP',
            version: '7.1'
        };

        const status = {
            code: 0,
            message: 'ok',
            pluginId: 'unknown',
            severity: 0
        };

        const discoveryPath = { fsPath: 'path/path' };

        setup(() => {
            findServerStub = sandbox.stub(clientStub, 'findServerBeans').resolves([serverBean]);
            showOpenDialogStub = sandbox.stub(window, 'showOpenDialog').resolves([discoveryPath]);
        });

        test('should detect the server in a given location', async () => {
            sandbox.stub(window, 'showInputBox').resolves('eap');
            sandbox.stub(clientStub, 'createServerAsync').resolves(status);
            await serverExplorer.addLocation();

            expect(findServerStub).calledOnceWith(discoveryPath.fsPath);
            expect(showOpenDialogStub).calledOnce;
        });

        test('should call client.createServerAsync with detected server bean for location and name provided by user', async () => {
            sandbox.stub(window, 'showInputBox').resolves('eap');
            const createServerStub = sandbox.stub(clientStub, 'createServerAsync').resolves(status);
            await serverExplorer.addLocation();

            expect(createServerStub).calledOnceWith(serverBean, 'eap');
        });

        test('should error if no server detected in provided location', async () => {
            findServerStub.resolves(serverBean);

            try {
                await serverExplorer.addLocation();
                expect.fail();
            } catch (err) {
                expect(err).equals('Cannot detect server in selected location!');
            }
        });
    });
});