import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { ServersViewTreeDataProvider } from '../src/serverExplorer';
import { RSPClient, Protocol} from 'rsp-client';
import { EventEmitter, window } from 'vscode';

const expect = chai.expect;
chai.use(sinonChai);

suite('Server explorer', () => {
    let sandbox: sinon.SinonSandbox;
    let clientStub: sinon.SinonStubbedInstance<RSPClient> = new RSPClient('somehost', 8080);;
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
        state: 0
    };

    const ProcessOutput: Protocol.ServerProcessOutput = {
        processId: "process id",
        server: serverHandle,
        streamType: 0,
        text: "the type"
    };

    test('should able to insert the server', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        sandbox = sinon.createSandbox();
        const refreshStub = sandbox.stub(serverExplorer, 'refresh').returns(null);
        serverExplorer.insertServer(serverHandle);
        expect(refreshStub).calledOnce;
    });

    test('should able to removeServer the server ', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const disposeStub = sinon.stub(serverExplorer.serverOutputChannels, 'get').returns({
            clear: () => {},
            dispose: () => {}
        });
        sandbox.stub(serverExplorer, 'refresh')
        serverExplorer.removeServer(serverHandle);
        expect(disposeStub).calledOnce;
    });

    test('should able to updateServer the server ', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const serviceStub = sinon.stub(serverExplorer.servers, 'get').returns({
            stateChange
        });
        const clearStub = sinon.stub(serverExplorer.serverOutputChannels, 'get').returns({
            clear: () => {},
        });
        sandbox.stub(serverExplorer, 'refresh')
        serverExplorer.updateServer(stateChange);
        expect(serviceStub).calledOnce;
        expect(clearStub).calledOnce;
    });

    test('should able to showOutput of the server ', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const clearStub = sinon.stub(serverExplorer.serverOutputChannels, 'get').returns({
            show: () => {}
        });
        serverExplorer.showOutput(serverHandle);
        expect(clearStub).calledOnce;
    });

    test('should able to getTreeItem of the server', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const clearStub = sinon.stub(serverExplorer.serverStatus, 'get').returns({
            serverHandle
        });
        serverExplorer.getTreeItem(serverHandle);
        expect(clearStub).calledOnce;
    });

    test('should able to getChildren of the server', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const clearStub = sinon.stub(serverExplorer.servers, 'values').returns([]);
        const getChildren = serverExplorer.getChildren(undefined);
        expect(getChildren).deep.equals(Array.from(clearStub));
    });

    test('should able to getTreeItem of the server', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const clearStub = sinon.stub(serverExplorer.serverOutputChannels, 'get').returns(undefined);
        serverExplorer.addServerOutput(ProcessOutput);
        expect(clearStub).calledOnce;
    });

    test('should able to refresh of the server', () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        const clearStub = sinon.stub(EventEmitter.prototype, 'fire');
        serverExplorer.refresh(serverHandle);
        expect(clearStub).calledOnce;
        expect(clearStub).calledOnceWith(serverHandle);
    });

    test('should able to addLocation for the server', async () => {
        sinon.stub(clientStub, 'findServerBeans').resolves({
            length: 1,
            fullVersion:"7.1.0.GA",
            location:"c:\\Users\\sverma\\EAP-7.1.0",
            name:"EAP-7.1.0",
            serverAdapterTypeId:"org.jboss.ide.eclipse.as.eap.71",
            specificType:"EAP",
            typeCategory:"EAP",
            version:"7.1"
        });
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        sinon.stub(window, 'showOpenDialog').resolves([{fsPath: 'path/path'}]);
        await serverExplorer.addLocation();
        // expect(findServerbeansStub).calledOnceWith(addlocation);
    });
});