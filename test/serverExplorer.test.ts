import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { ServersViewTreeDataProvider } from '../src/serverExplorer';
import { RSPClient, Protocol } from 'rsp-client';
import { EventEmitter, window } from 'vscode';

const expect = chai.expect;
chai.use(sinonChai);

suite('Server explorer', () => {

    let sandbox: sinon.SinonSandbox;
    const clientStub: sinon.SinonStubbedInstance<RSPClient> = new RSPClient('somehost', 8080);
    let serverExplorer: ServersViewTreeDataProvider;

    setup(() => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        sandbox = sinon.createSandbox();
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

    test('insertServer call should add server to tree data model', () => {
        const refreshStub = sandbox.stub(serverExplorer, 'refresh');
        serverExplorer.insertServer(serverHandle);
        const getChildren = serverExplorer.getChildren(undefined);
        expect(refreshStub).calledOnce;
        expect(getChildren).deep.equals(Array.from([serverHandle]));
    });

    test('removeServer call should remove server from tree data model', () => {
        const disposeStub = sandbox.stub(serverExplorer.serverOutputChannels, 'get').returns({
            clear: () => {},
            dispose: () => {}
        });
        const getChildren = serverExplorer.getChildren(undefined);
        sandbox.stub(serverExplorer, 'refresh');
        serverExplorer.insertServer(serverHandle);
        serverExplorer.removeServer(serverHandle);
        expect(disposeStub).calledOnce;
        expect(getChildren).deep.equals(Array.from([]));
    });

    test('serverExplorer.showOutput call should show servers output channel', () => {
        const showStub = sandbox.stub(serverExplorer.serverOutputChannels, 'get').returns({
            show: () => {}
        });
        serverExplorer.showOutput(serverHandle);
        expect(showStub).calledOnce;
    });

    test('serverExplorer.addServerOutput call should able to show ServerOutput channel', () => {
        const getStub = sandbox.stub(serverExplorer.serverOutputChannels, 'get').returns(undefined);
        serverExplorer.addServerOutput(ProcessOutput);
        expect(getStub).calledOnce;
    });

    test('serverExplorer.addServerOutput call should show ServerOutput', () => {
        const getStub = sandbox.stub(serverExplorer.serverOutputChannels, 'get').returns({
            show: () => {},
            append: () => {}
        });
        serverExplorer.addServerOutput(ProcessOutput);
        expect(getStub).calledOnce;
    });

    test('serverExplorer.refresh() should trigger serverExporer.getChildren() call for root node', () => {
        const fireStub = sandbox.stub(EventEmitter.prototype, 'fire');
        serverExplorer.refresh(serverHandle);
        expect(fireStub).calledOnce;
        expect(fireStub).calledOnceWith(serverHandle);
    });
});

suite('serverExplorer.updateServer', () => {

    let sandbox: sinon.SinonSandbox;
    let serviceStub: sinon.SinonSandbox;
    let serverStatusStub: sinon.SinonSandbox;
    let getStub: sinon.SinonSandbox;
    const clientStub: sinon.SinonStubbedInstance<RSPClient> = new RSPClient('somehost', 8080);
    let serverExplorer: ServersViewTreeDataProvider;

    const serverType: Protocol.ServerType = {
        description: 'a type',
        id: 'type',
        visibleName: `the type`
    };

    const serverHandle: Protocol.ServerHandle = {
        id: 'id',
        type: serverType
    };

    const serverStop = {
        collapsibleState: 0,
        label: `id:the type(Stopped)`,
        contextValue: 'Stopped'
    };

    const serverStart = {
        collapsibleState: 0,
        label: 'id:the type(Started)',
        contextValue: 'Started'
    };

    const serverUnknown = {
        collapsibleState: 0,
        label: 'id:the type(Unknown)',
        contextValue: 'Unknown'
    };

    setup(() => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        sandbox = sinon.createSandbox();
        getStub = sandbox.stub(serverExplorer.serverOutputChannels, 'get').returns({
            clear: () => {}
        });
        sandbox.stub(serverExplorer.servers, 'values').returns(Array.from([serverHandle]));
    });

    teardown(() => {
        sandbox.restore();
    });

    test('call should update server state to received in state change event (Stopped)', () => {
        const stateChangeStopping: Protocol.ServerStateChange = {
            server: serverHandle,
            state: 3
        };
        serviceStub = sandbox.stub(serverExplorer.servers, 'get').returns({
            stateChangeStopping
        });
        serverStatusStub = sandbox.stub(serverExplorer.serverStatus, 'set');
        sandbox.stub(serverExplorer.serverStatusEnum, 'get').returns('Stopped');
        const stateChangeStopped: Protocol.ServerStateChange = {
            server: serverHandle,
            state: 4
        };
        const getChildren = serverExplorer.getChildren(undefined);
        const getTreeItem = serverExplorer.getTreeItem(serverHandle);
        serverExplorer.updateServer(stateChangeStopping);
        serverExplorer.refresh();
        serverExplorer.updateServer(stateChangeStopped);
        expect(serviceStub).calledTwice;
        expect(serverStatusStub).calledTwice;
        expect(getStub).calledTwice;
        expect(getChildren).deep.equals(Array.from([serverHandle]));
        expect(getTreeItem).deep.equals(serverStop);
    });

    test('call should update server state to received in state change event (Started)', () => {
        const stateChangeStarting: Protocol.ServerStateChange = {
            server: serverHandle,
            state: 1
        };
        serviceStub = sandbox.stub(serverExplorer.servers, 'get').returns({
            stateChangeStarting
        });
        serverStatusStub = sandbox.stub(serverExplorer.serverStatus, 'set');
        sandbox.stub(serverExplorer.serverStatusEnum, 'get').returns('Started');
        const stateChangeStarted: Protocol.ServerStateChange = {
            server: serverHandle,
            state: 2
        };
        const getChildren = serverExplorer.getChildren(undefined);
        const getTreeItem = serverExplorer.getTreeItem(serverHandle);
        serverExplorer.updateServer(stateChangeStarting);
        serverExplorer.refresh();
        serverExplorer.updateServer(stateChangeStarted);
        expect(serviceStub).calledTwice;
        expect(serverStatusStub).calledTwice;
        expect(getStub).calledTwice;
        expect(getChildren).deep.equals(Array.from([serverHandle]));
        expect(getTreeItem).deep.equals(serverStart);
    });

    test('call should update server state to received in state change event (Unknown)', () => {
        const stateChangeUnknown: Protocol.ServerStateChange = {
            server: serverHandle,
            state: 0
        };
        serviceStub = sandbox.stub(serverExplorer.servers, 'get').returns({
            stateChangeUnknown
        });
        serverStatusStub = sandbox.stub(serverExplorer.serverStatus, 'set');
        sandbox.stub(serverExplorer.serverStatusEnum, 'get').returns('Unknown');
        const getChildren = serverExplorer.getChildren(undefined);
        const getTreeItem = serverExplorer.getTreeItem(serverHandle);
        serverExplorer.updateServer(stateChangeUnknown);
        expect(serviceStub).calledOnce;
        expect(serverStatusStub).calledOnce;
        expect(getStub).calledOnce;
        expect(getChildren).deep.equals(Array.from([serverHandle]));
        expect(getTreeItem).deep.equals(serverUnknown);
    });
});

suite('serverExplorer.addLocation', () => {

    let sandbox: sinon.SinonSandbox;
    const clientStub: sinon.SinonStubbedInstance<RSPClient> = new RSPClient('somehost', 8080);
    let serverExplorer: ServersViewTreeDataProvider;

    const findServerBeans = {
        length: 1,
        fullVersion: 'version',
        location: 'path',
        name: 'EAP',
        serverAdapterTypeId: 'org.jboss',
        specificType: 'EAP',
        version: '7.1'
    };

    const ServerBeans = {
        length: 1,
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

    setup(() => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('serverExplorer.addLocation should ask for location of the server and name if server detected in provided location', async () => {
        const findServerStub = sandbox.stub(clientStub, 'findServerBeans').resolves([ServerBeans]);
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const showOpenDialogStub = sinon.stub(window, 'showOpenDialog').resolves([{fsPath: 'path/path'}]);
        sandbox.stub(window, 'showInputBox').resolves('eap');
        sandbox.stub(clientStub, 'createServerAsync').resolves(status);
        await serverExplorer.addLocation();
        expect(findServerStub).calledOnce;
        expect(showOpenDialogStub).calledOnce;
    });

    test('serverExplorer.addLocation should call client.createServerAsync with detected server bean for location and name provided by user', async () => {
        const findServerStub = sandbox.stub(clientStub, 'findServerBeans').resolves([ServerBeans]);
        sandbox.stub(window, 'showInputBox').resolves('eap');
        sandbox.stub(clientStub, 'createServerAsync');
        await serverExplorer.addLocation();
        expect(findServerStub).calledOnce;
    });

    test('should show message if no server detected in provided location', async () => {
        const findServerStub = sandbox.stub(clientStub, 'findServerBeans').resolves([findServerBeans]);
        sandbox.stub(window, 'showInformationMessage')
        await serverExplorer.addLocation();
        expect(findServerStub).calledOnce;
    });
});