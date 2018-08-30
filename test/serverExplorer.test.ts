import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { ServersViewTreeDataProvider } from '../src/serverExplorer';
// import * as vscode from 'vscode';
import { RSPClient, Protocol} from 'rsp-client';

const expect = chai.expect;
chai.use(sinonChai);

suite('Server explorer', () => {
    let sandbox: sinon.SinonSandbox;
    let clientStub: sinon.SinonStubbedInstance<RSPClient>;
    let serverExplorer: ServersViewTreeDataProvider;
    // let OutputChannelStub: sinon.SinonStubbedInstance<vscode.OutputChannel>

    // const fakeConnection = {
    //     set: () => {}
    // };

    const serverType: Protocol.ServerType = {
        description: 'a type',
        id: 'type',
        visibleName: 'the type'
    };

    const serverHandle: Protocol.ServerHandle = {
        id: 'id',
        type: serverType
    };

    suite('insertServer', () => {
        test('should able to insert the server', async () => {
            serverExplorer = new ServersViewTreeDataProvider(clientStub);
            sandbox = sinon.createSandbox();
            const refreshStub = sandbox.stub(serverExplorer, 'refresh').returns(null);
            serverExplorer.insertServer(serverHandle);
            expect(refreshStub).calledOnce;
        });
    });

});