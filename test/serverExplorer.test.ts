import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { ServersViewTreeDataProvider } from '../src/serverExplorer';
// import {
//     OutputChannel
// } from 'vscode';
import { RSPClient, Protocol} from 'rsp-client';

const expect = chai.expect;
chai.use(sinonChai);

suite('Server explorer', () => {
    let sandbox: sinon.SinonSandbox;
    let clientStub: sinon.SinonStubbedInstance<RSPClient>;
    let serverExplorer: ServersViewTreeDataProvider;

    const serverType: Protocol.ServerType = {
        description: 'a type',
        id: 'type',
        visibleName: 'the type'
    };

    const fakeConnection = {
        get: () => {}
    };

    const serverHandle: Protocol.ServerHandle = {
        id: 'id',
        type: serverType
    };

    // const stateChange: Protocol.ServerStateChange = {
    //     server: serverHandle,
    //     state: 4
    // };

    test('should able to insert the server', async () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        sandbox = sinon.createSandbox();
        const refreshStub = sandbox.stub(serverExplorer, 'refresh').returns(null);
        serverExplorer.insertServer(serverHandle);
        expect(refreshStub).calledOnce;
    });

    test('should able to insert the server', async () => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        sandbox = sinon.createSandbox();
        const refreshStub = sandbox.stub(serverExplorer, 'refresh').returns(null);
        serverExplorer.removeServer(serverHandle);
        expect(refreshStub).calledOnce;
    });

});