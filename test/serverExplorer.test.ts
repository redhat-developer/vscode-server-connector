import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { ServersViewTreeDataProvider } from '../src/serverExplorer';
import * as vscode from 'vscode';
import { RSPClient, Protocol, ServerState} from 'rsp-client';

const expect = chai.expect;
chai.use(sinonChai);

describe('Server explorer', () => {
    let sandbox: sinon.SinonSandbox;
    let clientStub: sinon.SinonStubbedInstance<RSPClient>;
    let serverExplorer: ServersViewTreeDataProvider;
    let OutputChannelStub: sinon.SinonStubbedInstance<vscode.OutputChannel>;

    const serverType: Protocol.ServerType = {
        description: 'a type',
        id: 'type',
        visibleName: 'the type'
    };

    const serverHandle: Protocol.ServerHandle = {
        id: 'id',
        type: serverType
    };
    
    beforeEach(() => {
        serverExplorer = new ServersViewTreeDataProvider(clientStub);
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('removeServer', () => {
        it('should able to remove the server', async () => {
            const result = await serverExplorer.removeServer(serverHandle);
        });
    });

});