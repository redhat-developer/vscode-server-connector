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

    const serverType: Protocol.ServerType = {
        description: 'a type',
        id: 'type',
        visibleName: 'the type'
    };

    const serverHandle: Protocol.ServerHandle = {
        id: 'id',
        type: serverType
    };

    const stateChange: Protocol.ServerStateChange = {
        server: serverHandle,
        state: 1
    };

    const ProcessOutput: Protocol.ServerProcessOutput = {
        processId: 'process id',
        server: serverHandle,
        streamType: 0,
        text: 'the type'
    };

    const findServerBeans = {
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

    test('InsertServer call should add server to tree data model', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        sandbox = sinon.createSandbox();
        const refreshStub = sandbox.stub(serverExplorer, 'refresh').returns(null);
        const getChildren = serverExplorer.getChildren(null);
        serverExplorer.insertServer(serverHandle);
        expect(refreshStub).calledOnce;
        expect(getChildren).deep.equals(undefined);
    });

    test('removeServer call should remove server from tree data model', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const disposeStub = sinon.stub(serverExplorer.serverOutputChannels, 'get').returns({
            clear: () => {},
            dispose: () => {}
        });
        const getChildren = serverExplorer.getChildren(null);
        sandbox.stub(serverExplorer, 'refresh');
        serverExplorer.removeServer(serverHandle);
        expect(disposeStub).calledOnce;
        expect(getChildren).deep.equals(undefined);
    });

    test('serverExplorer.updateServer call should update server state to received in state change event', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const serviceStub = sinon.stub(serverExplorer.servers, 'get').returns({
            stateChange
        });
        const clearStub = sinon.stub(serverExplorer.serverOutputChannels, 'get').returns({
            clear: () => {
                return true;
            }
        });
        sandbox.stub(serverExplorer, 'refresh');
        const updateserver = serverExplorer.updateServer(stateChange);
        expect(serviceStub).calledOnce;
        expect(clearStub).calledOnce;
        expect(clearStub).calledOnceWith(updateserver);
    });

    test('serverExplorer.showOutput call should show servers output channel', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const showStub = sinon.stub(serverExplorer.serverOutputChannels, 'get').returns({
            show: () => {}
        });
        serverExplorer.showOutput(serverHandle);
        expect(showStub).calledOnce;

    });

    test('serverExplorer.getTreeItem call should return TreeItem instance with corresponding label', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const serverHandleStub = sinon.stub(serverExplorer.serverStatus, 'get').resolves({
            serverHandle
        });
        serverExplorer.getTreeItem(serverHandle);
        expect(serverHandleStub).calledOnce;
    });

    test('should able to getChildren of the server', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const clearStub = sinon.stub(serverExplorer.servers, 'values').returns([]);
        const getChildren = serverExplorer.getChildren(undefined);
        expect(getChildren).deep.equals(Array.from(clearStub));
    });

    test('serverExplorer.addServerOutput call should show ServerOutput', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const getStub = sinon.stub(serverExplorer.serverOutputChannels, 'get').returns(undefined);
        serverExplorer.addServerOutput(ProcessOutput);
        expect(getStub).calledOnce;
    });

    test('serverExplorer.addServerOutput call should show ServerOutput', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const getStub = sinon.stub(serverExplorer.serverOutputChannels, 'get').returns({
            show: () => {},
            append: () => {}
        });
        serverExplorer.addServerOutput(ProcessOutput);
        expect(getStub).calledOnce;
    });

    test('serverExplorer.refresh call should able check server refresh', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const fireStub = sinon.stub(EventEmitter.prototype, 'fire');
        serverExplorer.refresh(serverHandle);
        expect(fireStub).calledOnce;
        expect(fireStub).calledOnceWith(serverHandle);
    });

    test('serverExplorer.addLocation should ask for location of the server and name if server detected in provided location', async () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const showOpenDialogStub = sinon.stub(window, 'showOpenDialog').resolves([{fsPath: 'path/path'}]);
        await serverExplorer.addLocation();
        expect(showOpenDialogStub).calledOnce;
    });

    test('serverExplorer.addLocation should call client.createServerAsync with detected server bean for location and name provided by user', async () => {
        const findServerStub = sinon.stub(clientStub, 'findServerBeans').resolves([findServerBeans]);
        sinon.stub(window, 'showInputBox').resolves('eap');
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        sinon.stub(clientStub, 'createServerAsync').resolves(status);
        await serverExplorer.addLocation();
        expect(findServerStub).calledOnce;
    });
});

suite('serverExplorer.addLocation', () => {
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

    test('should show message if no server detected in provided location', async () => {
        const findServerStub = sinon.stub(clientStub, 'findServerBeans').resolves([findServerBeans]);
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        await serverExplorer.addLocation();
        expect(findServerStub).calledOnce;
    });
});