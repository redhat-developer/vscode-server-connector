
/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { ClientStubs } from './clientstubs';
import * as path from 'path';
import { ProtocolStubs } from './protocolstubs';
import { Protocol } from 'rsp-client';
import { ServerExplorer } from '../src/serverExplorer';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { EventEmitter, OutputChannel, TreeItemCollapsibleState, Uri, window } from 'vscode';

const expect = chai.expect;
chai.use(sinonChai);

suite('Server explorer', () => {

    let sandbox: sinon.SinonSandbox;
    let getStub: sinon.SinonStub;
    let stubs: ClientStubs;
    let serverExplorer: ServerExplorer;

    const fakeChannel: OutputChannel = {
        append: () => {},
        show: () => {},
        clear: () => {},
        dispose: () => {},
        appendLine: () => {},
        hide: () => {},
        name: 'fake'
    };

    setup(() => {
        sandbox = sinon.createSandbox();

        stubs = new ClientStubs(sandbox);
        stubs.outgoing.getServerHandles = sandbox.stub().resolves([]);
        stubs.outgoing.getServerState = sandbox.stub().resolves(ProtocolStubs.serverState);

        serverExplorer = new ServerExplorer(stubs.client);
        getStub = sandbox.stub(serverExplorer.serverOutputChannels, 'get').returns(fakeChannel);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('insertServer call should add server to tree data model', async () => {
        const refreshStub = sandbox.stub(serverExplorer, 'refresh');
        await serverExplorer.insertServer(ProtocolStubs.serverHandle);
        const children = serverExplorer.getChildren();

        expect(refreshStub).calledOnce;
        expect(children.length).equals(1);
        expect(children[0].server).exist;
        expect(children[0].server).deep.equals(ProtocolStubs.serverHandle);
    });

    test('removeServer call should remove server from tree data model', () => {
        const children = serverExplorer.getChildren();
        sandbox.stub(serverExplorer, 'refresh');
        serverExplorer.insertServer(ProtocolStubs.serverHandle);
        serverExplorer.removeServer(ProtocolStubs.serverHandle);

        expect(getStub).calledOnce;
        expect(children).empty;
    });

    test('showOutput call should show servers output channel', () => {
        const spy = sandbox.spy(fakeChannel, 'show');
        serverExplorer.showOutput(ProtocolStubs.serverState);

        expect(getStub).calledOnce;
        expect(spy).calledOnce;
    });

    test('addServerOutput call should show ServerOutput channel', () => {
        const appendSpy = sandbox.spy(fakeChannel, 'append');
        serverExplorer.addServerOutput(ProtocolStubs.processOutput);

        expect(getStub).calledOnce;
        expect(appendSpy).calledOnce;
    });

    test('refresh element should fire event for element', () => {
        // given
        const fireStub = sandbox.stub(EventEmitter.prototype, 'fire');
        serverExplorer.selectNode = sandbox.stub();

        // when
        serverExplorer.refresh(ProtocolStubs.serverState);

        // then
        expect(fireStub).calledOnce;
    });

    suite('updateServer', () => {

        let setStatusStub: sinon.SinonStub;

        const stateChangeUnknown: Protocol.ServerState = {
            server: ProtocolStubs.serverHandle,
            state: 0,
            publishState: 1,
            deployableStates: []
        };
        const stateChangeStarting: Protocol.ServerState = {
            server: ProtocolStubs.serverHandle,
            state: 1,
            publishState: 1,
            deployableStates: []
        };
        const stateChangeStarted: Protocol.ServerState = {
            server: ProtocolStubs.serverHandle,
            state: 2,
            publishState: 1,
            deployableStates: []
        };
        const stateChangeStopping: Protocol.ServerState = {
            server: ProtocolStubs.serverHandle,
            state: 3,
            publishState: 1,
            deployableStates: []
        };
        const stateChangeStopped: Protocol.ServerState = {
            server: ProtocolStubs.serverHandle,
            state: 4,
            publishState: 1,
            deployableStates: []
        };

        const serverStop = {
            collapsibleState: TreeItemCollapsibleState.Expanded,
            label: `id (Stopped) (undefined)`,
            contextValue: 'Stopped',
            iconPath: Uri.file(path.join(__dirname, '../../images/server-light.png'))
        };

        const serverStart = {
            collapsibleState: TreeItemCollapsibleState.Expanded,
            label: 'id (Started) (undefined)',
            contextValue: 'Started',
            iconPath: Uri.file(path.join(__dirname, '../../images/server-light.png'))
        };

        const serverUnknown = {
            collapsibleState: TreeItemCollapsibleState.Expanded,
            label: 'id (Unknown) (undefined)',
            contextValue: 'Unknown',
            iconPath: Uri.file(path.join(__dirname, '../../images/server-light.png'))
        };

        setup(() => {
            serverExplorer.serverStatus =  new Map<string, Protocol.ServerState>([['server', ProtocolStubs.serverState]]);
            setStatusStub = sandbox.stub(serverExplorer.serverStatus, 'set');
        });

        test('call should update server state to received in state change event (Stopped)', () => {
            sandbox.stub(serverExplorer.runStateEnum, 'get').returns('Stopped');
            serverExplorer.selectNode = sandbox.stub();
            const children = serverExplorer.getChildren();
            const treeItem = serverExplorer.getTreeItem(ProtocolStubs.serverState);

            serverExplorer.updateServer(stateChangeStopping);
            serverExplorer.updateServer(stateChangeStopped);

            expect(setStatusStub).calledTwice;
            expect(getStub).calledTwice;
            expect(children).deep.equals([ProtocolStubs.serverState]);
            expect(treeItem).deep.equals(serverStop);
        });

        test('call should update server state to received in state change event (Started)', () => {
            sandbox.stub(serverExplorer.runStateEnum, 'get').returns('Started');
            serverExplorer.selectNode = sandbox.stub();
            const children = serverExplorer.getChildren();
            const treeItem = serverExplorer.getTreeItem(ProtocolStubs.serverState);

            serverExplorer.updateServer(stateChangeStarting);
            serverExplorer.updateServer(stateChangeStarted);

            expect(setStatusStub).calledTwice;
            expect(getStub).calledTwice;
            expect(children).deep.equals([ProtocolStubs.serverState]);
            expect(treeItem).deep.equals(serverStart);
        });

        test('call should update server state to received in state change event (Unknown)', () => {
            sandbox.stub(serverExplorer.runStateEnum, 'get').returns('Unknown');
            serverExplorer.selectNode = sandbox.stub();
            const children = serverExplorer.getChildren();
            const treeItem = serverExplorer.getTreeItem(ProtocolStubs.serverState);

            serverExplorer.updateServer(stateChangeUnknown);

            expect(setStatusStub).calledOnce;
            expect(getStub).calledOnce;
            expect(children).deep.equals([ProtocolStubs.serverState]);
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

        const serverBeanWithoutType: Protocol.ServerBean = {
            fullVersion: 'version',
            location: 'path',
            name: 'EAP',
            serverAdapterTypeId: '',
            specificType: 'EAP',
            typeCategory: 'EAP',
            version: '7.1'
        };

        const noAttributes: Protocol.Attributes = {
            attributes: { }
        };

        const status: Protocol.Status = {
            code: 0,
            message: 'ok',
            severity: 0,
            ok: true,
            plugin: 'plugin',
            trace: ''
        };

        const createResponse: Protocol.CreateServerResponse = {
            status: status,
            invalidKeys: []
        };

        const userSelectedPath = { fsPath: 'path/path' };

        const discoveryPath: Protocol.DiscoveryPath = {
            filepath: userSelectedPath.fsPath
        };

        setup(() => {
            findServerStub = stubs.outgoing.findServerBeans.resolves([serverBean]);

            showOpenDialogStub = sandbox.stub(window, 'showOpenDialog').resolves([userSelectedPath]);
            sandbox.stub(window, 'showQuickPick').resolves();
        });

        test('should detect and create the server in a given location', async () => {
            const inputBoxStub = sandbox.stub(window, 'showInputBox');
            inputBoxStub.onFirstCall().resolves('eap');
            inputBoxStub.onSecondCall().resolves('No');

            const createServerStub = stubs.serverCreation.createServerFromBeanAsync.resolves(createResponse);
            stubs.outgoing.getOptionalAttributes.resolves(noAttributes);
            stubs.outgoing.getRequiredAttributes.resolves(noAttributes);

            await serverExplorer.addLocation();
            expect(findServerStub).calledOnceWith(discoveryPath);
            expect(showOpenDialogStub).calledOnce;
            expect(createServerStub).calledOnceWith(serverBean, 'eap');
        });

        test('should error if no server detected in provided location', async () => {
            findServerStub.resolves([]);

            try {
                await serverExplorer.addLocation();
                expect.fail();
            } catch (err) {
                expect(err.message).length > 0;
            }
        });

        test('should error if adapter type is empty', async () => {
            findServerStub.resolves([serverBeanWithoutType]);

            try {
                await serverExplorer.addLocation();
                expect.fail();
            } catch (err) {
                expect(err.message).length > 0;
            }
        });
    });
});
