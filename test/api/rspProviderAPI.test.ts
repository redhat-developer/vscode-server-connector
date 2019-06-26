// The module 'assert' provides assertion methods from node
import * as chai from 'chai';
import { RSPProviderAPI, RSPServer } from '../../src/api/contract/rspProviderAPI';
import { impl } from '../../src/api/implementation/rspProviderAPI';
import { ServerExplorer } from '../../src/serverExplorer';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { window } from 'vscode';
import { ProtocolStubs } from '../protocolstubs';

const expect = chai.expect;
chai.use(sinonChai);

// Defines a Mocha test suite to group tests of similar kind together
suite('RSPProviderAPI Tests', () => {
    let sandbox: sinon.SinonSandbox;   
    let serverExplorer: ServerExplorer;
    let rspProviderImpl: RSPProviderAPI;

    const rspServer: RSPServer = {
        state: 0,
        type: {
            id: 'id',
            visibilename: 'name'
        }
    };

    setup(() => {
        sandbox = sinon.createSandbox();
        serverExplorer = ServerExplorer.getInstance();
        rspProviderImpl = impl();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('registerRSPProvider', () => {

        test('error if rspServer object is undefined', async () => {
            try {
                await rspProviderImpl.registerRSPProvider(undefined);
                expect.fail();
            } catch (err) {
                expect(err).equals('Unable to register RSP provider - RSP state is not valid.');
            }
        });

        test('error if rspServer type is undefined', async () => {
            const incompleteRSP: RSPServer = {
                type: undefined,
                state: 0
            };

            try {
                await rspProviderImpl.registerRSPProvider(incompleteRSP);
                expect.fail();
            } catch (err) {
                expect(err).equals('Unable to register RSP provider - Id is not valid.');
            }
        });

        test('error if rspServer type id is undefined', async () => {
            const incompleteRSP: RSPServer = {
                type: {
                    id: undefined,
                    visibilename: 'name'
                },
                state: 0
            };

            try {
                await rspProviderImpl.registerRSPProvider(incompleteRSP);
                expect.fail();
            } catch (err) {
                expect(err).equals('Unable to register RSP provider - Id is not valid.');
            }
        });

        test('check if new output channel is created', async () => {
            const stubCreateChannel = sandbox.stub(window, 'createOutputChannel');
            await rspProviderImpl.registerRSPProvider(rspServer);
            expect(stubCreateChannel).calledTwice;
        });

        test('check if serverExplorer instance is retrieved', async () => {
            const stubGetInstance = sandbox.stub(ServerExplorer, 'getInstance').returns(serverExplorer);
            await rspProviderImpl.registerRSPProvider(rspServer);
            expect(stubGetInstance).calledOnce;
        });

        test('check if new rsp is added to RSPServerStatus map', async () => {
            const newRSPServer: RSPServer = {
                state: 0,
                type: {
                    id: 'newFakeId',
                    visibilename: 'name'
                }
            };
            sandbox.stub(ServerExplorer, 'getInstance').returns(serverExplorer);

            expect(serverExplorer.RSPServersStatus.size).equals(1);
            await rspProviderImpl.registerRSPProvider(newRSPServer);
            expect(serverExplorer.RSPServersStatus.size).equals(2);
            // clear map - used to prevent other tests to fail
            serverExplorer.RSPServersStatus.delete('newFakeId');
        });

        test('check if refreshtree is called', async () => {
            const stubRefreshtree = sandbox.stub(serverExplorer, 'refreshTree');
            await rspProviderImpl.registerRSPProvider(rspServer);
            expect(stubRefreshtree).calledOnce;
        });
    });

    suite('deregisterRSPProvider', () => {
        test('error if id is undefined', async () => {
            try {
                await rspProviderImpl.deregisterRSPProvider(undefined);
                expect.fail();
            } catch (err) {
                expect(err).equals('Unable to remove RSP provider - Id is not valid.');
            }
        });

        test('check if serverExplorer instance is retrieved', async () => {
            const stubGetInstance = sandbox.stub(ServerExplorer, 'getInstance').returns(serverExplorer);
            await rspProviderImpl.deregisterRSPProvider('id');
            expect(stubGetInstance).calledOnce;
        });

        test('error if id is not a valid RSP within RSPServerStatus map', async () => {
            try {
                await rspProviderImpl.deregisterRSPProvider('newFakeId');
                expect.fail();
            } catch (err) {
                expect(err).equals('No RSP Provider was found with this id.');
            }
        });

        test('check if deregister remove rsp from RSPServerStatus map', async () => {
            sandbox.stub(ServerExplorer, 'getInstance').returns(serverExplorer);
            serverExplorer.RSPServersStatus.set('newFakeId', ProtocolStubs.rspProperties);
            expect(serverExplorer.RSPServersStatus.size).equals(1);
            await rspProviderImpl.deregisterRSPProvider('newFakeId');
            expect(serverExplorer.RSPServersStatus.size).equals(0);
        });
    });

});
