
/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { ClientStubs } from './clientstubs';
import * as path from 'path';
import { ProtocolStubs } from './protocolstubs';
import { Protocol, ServerState } from 'rsp-client';
import { ServerExplorer } from '../src/serverExplorer';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { EventEmitter, OpenDialogOptions, OutputChannel, TreeItemCollapsibleState, Uri, window } from 'vscode';

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
        stubs.outgoing.getServerState = sandbox.stub().resolves(ProtocolStubs.unknownServerState);

        //serverExplorer = new ServerExplorer(stubs.client); // to be modified
        getStub = sandbox.stub(serverExplorer.serverOutputChannels, 'get').returns(fakeChannel);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('insertServer call should add server', async () => {
        // given
        sandbox.stub(serverExplorer, 'refresh');
        stubs.outgoing.getServerState = sandbox.stub().resolves(ProtocolStubs.startedServerState);
        const insertStub = serverExplorer.serverStatus.set = sandbox.stub();
        // when
        await serverExplorer.insertServer(ProtocolStubs.serverHandle);
        // then
        expect(insertStub).to.be.calledOnceWith(ProtocolStubs.startedServerState.server.id, ProtocolStubs.startedServerState);
    });

    test('removeServer call should remove server', () => {
        // given
        serverExplorer.serverStatus.set(ProtocolStubs.startedServerState.server.id, ProtocolStubs.startedServerState);
        const deleteStub = serverExplorer.serverStatus.delete = sandbox.stub();
        sandbox.stub(serverExplorer, 'refresh')
        // when
        serverExplorer.removeServer(ProtocolStubs.serverHandle);
        // then
        expect(deleteStub).to.be.calledOnceWith(ProtocolStubs.serverHandle.id);
    });

    test('showOutput call should show servers output channel', () => {
        // given
        const spy = sandbox.spy(fakeChannel, 'show');
        // when
        serverExplorer.showOutput(ProtocolStubs.unknownServerState);
        // then
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
        serverExplorer.serverStatus.set(ProtocolStubs.unknownServerState.server.id, ProtocolStubs.unknownServerState);
        // when
        serverExplorer.refresh(ProtocolStubs.unknownServerState);
        // then
        expect(fireStub).calledOnce;
    });

    suite('updateServer', () => {

        let setStatusStub: sinon.SinonStub;

        const stateChangeUnknown: Protocol.ServerState = {
            server: ProtocolStubs.serverHandle,
            state: 0,
            publishState: 1,
            runMode: ServerState.RUN_MODE_RUN,
            deployableStates: []
        };
        const stateChangeStarting: Protocol.ServerState = {
            server: ProtocolStubs.serverHandle,
            state: 1,
            publishState: 1,
            runMode: ServerState.RUN_MODE_RUN,
            deployableStates: []
        };
        const stateChangeStarted: Protocol.ServerState = {
            server: ProtocolStubs.serverHandle,
            state: 2,
            publishState: 1,
            runMode: ServerState.RUN_MODE_RUN,
            deployableStates: []
        };
        const stateChangeDebuggingStarting: Protocol.ServerState = {
            server: ProtocolStubs.serverHandle,
            state: 1,
            publishState: 1,
            runMode: ServerState.RUN_MODE_DEBUG,
            deployableStates: []
        };
        const stateChangeDebugging: Protocol.ServerState = {
            server: ProtocolStubs.serverHandle,
            state: 2,
            publishState: 1,
            runMode: ServerState.RUN_MODE_DEBUG,
            deployableStates: []
        };
        const stateChangeStopping: Protocol.ServerState = {
            server: ProtocolStubs.serverHandle,
            state: 3,
            publishState: 1,
            runMode: ServerState.RUN_MODE_RUN,
            deployableStates: []
        };
        const stateChangeStopped: Protocol.ServerState = {
            server: ProtocolStubs.serverHandle,
            state: 4,
            publishState: 1,
            runMode: ServerState.RUN_MODE_RUN,
            deployableStates: []
        };

        const serverStop = {
            collapsibleState: TreeItemCollapsibleState.Expanded,
            label: `id (Stopped) (Unknown)`,
            contextValue: 'Stopped',
            iconPath: Uri.file(path.join(__dirname, '../../images/server-light.png'))
        };

        const serverStart = {
            collapsibleState: TreeItemCollapsibleState.Expanded,
            label: 'id (Started) (Unknown)',
            contextValue: 'Started',
            iconPath: Uri.file(path.join(__dirname, '../../images/server-light.png'))
        };

        const serverDebugging = {
            collapsibleState: TreeItemCollapsibleState.Expanded,
            label: 'id (Debugging) (undefined)',
            contextValue: 'Debugging',
            iconPath: Uri.file(path.join(__dirname, '../../images/server-light.png'))
        };

        const serverUnknown = {
            collapsibleState: TreeItemCollapsibleState.Expanded,
            label: 'id (Unknown) (Unknown)',
            contextValue: 'Unknown',
            iconPath: Uri.file(path.join(__dirname, '../../images/server-light.png'))
        };

        setup(() => {
            serverExplorer.serverStatus =  new Map<string, Protocol.ServerState>([['server', ProtocolStubs.unknownServerState]]);
            setStatusStub = sandbox.stub(serverExplorer.serverStatus, 'set');
        });

        test('call should update server state to received in state change event (Stopped)', () => {
            sandbox.stub(serverExplorer.runStateEnum, 'get').returns('Stopped');
            serverExplorer.selectNode = sandbox.stub();
            const children = serverExplorer.getChildren();
            const treeItem = serverExplorer.getTreeItem(ProtocolStubs.unknownServerState);

            serverExplorer.updateServer(stateChangeStopping);
            serverExplorer.updateServer(stateChangeStopped);

            expect(setStatusStub).calledTwice;
            expect(getStub).calledTwice;
            expect(children).deep.equals([ProtocolStubs.unknownServerState]);
            expect(treeItem).deep.equals(serverStop);
        });

        test('call should update server state to received in state change event (Started)', () => {
            sandbox.stub(serverExplorer.runStateEnum, 'get').returns('Started');
            serverExplorer.selectNode = sandbox.stub();
            const children = serverExplorer.getChildren();
            const treeItem = serverExplorer.getTreeItem(ProtocolStubs.unknownServerState);

            serverExplorer.updateServer(stateChangeStarting);
            serverExplorer.updateServer(stateChangeStarted);

            expect(setStatusStub).calledTwice;
            expect(getStub).calledTwice;
            expect(children).deep.equals([ProtocolStubs.unknownServerState]);
            expect(treeItem).deep.equals(serverStart);
        });

        test('call should update server state to received in state change event (Debugging)', () => {
            serverExplorer.serverStatus =  new Map<string, Protocol.ServerState>([['server', ProtocolStubs.serverDebuggingState]]);

            const children = serverExplorer.getChildren();
            const treeItem = serverExplorer.getTreeItem(ProtocolStubs.serverDebuggingState);

            serverExplorer.updateServer(stateChangeDebuggingStarting);
            serverExplorer.updateServer(stateChangeDebugging);

            expect(children).deep.equals([ProtocolStubs.serverDebuggingState]);
            expect(treeItem).deep.equals(serverDebugging);
        });

        test('call should update server state to received in state change event (Unknown)', () => {
            sandbox.stub(serverExplorer.runStateEnum, 'get').returns('Unknown');
            serverExplorer.selectNode = sandbox.stub();
            const children = serverExplorer.getChildren();
            const treeItem = serverExplorer.getTreeItem(ProtocolStubs.unknownServerState);

            serverExplorer.updateServer(stateChangeUnknown);

            expect(setStatusStub).calledOnce;
            expect(getStub).calledOnce;
            expect(children).deep.equals([ProtocolStubs.unknownServerState]);
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

            //await serverExplorer.addLocation(); // to be modified
            expect(findServerStub).calledOnceWith(discoveryPath);
            expect(showOpenDialogStub).calledOnce;
            expect(createServerStub).calledOnceWith(serverBean, 'eap');
        });

        test('should error if no server detected in provided location', async () => {
            findServerStub.resolves([]);

            try {
                //await serverExplorer.addLocation(); // to be modified
                expect.fail();
            } catch (err) {
                expect(err.message).length > 0;
            }
        });

        test('should error if adapter type is empty', async () => {
            findServerStub.resolves([serverBeanWithoutType]);

            try {
                //await serverExplorer.addLocation(); // to be modified
                expect.fail();
            } catch (err) {
                expect(err.message).length > 0;
            }
        });
    });

    suite('addDeployment', () => {
        const enum deploymentStatus {
            file = 'File',
            exploded = 'Exploded'
        }

        const userSelectedPath = { fsPath: 'path/path' };

        test('check dialog options are set up correctly when choosing file in Windows', async () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32'
            });
            sandbox.stub(serverExplorer, 'quickPickDeploymentType' as any).resolves(deploymentStatus.file);

            const filePickerResponseWindows = {
                canSelectFiles: true,
                canSelectMany: false,
                canSelectFolders: false,
                openLabel: `Select File Deployment`
            };
            const stubDialog = sandbox.stub(window, 'showOpenDialog');
            await serverExplorer.addDeployment(undefined);

            const filePickerResult = stubDialog.getCall(0).args[0];
            expect(JSON.stringify(filePickerResult)).equals(JSON.stringify(filePickerResponseWindows));
        });

        test('check dialog options are set up correctly when choosing folder in Windows', async () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32'
            });
            sandbox.stub(serverExplorer, 'quickPickDeploymentType' as any).resolves(deploymentStatus.exploded);

            const folderPickerResponseWindows = {
                canSelectFiles: false,
                canSelectMany: false,
                canSelectFolders: true,
                openLabel: `Select Exploded Deployment`
            };
            const stubDialog = sandbox.stub(window, 'showOpenDialog');
            await serverExplorer.addDeployment(undefined);

            const folderPickerResult = stubDialog.getCall(0).args[0];
            expect(JSON.stringify(folderPickerResult)).equals(JSON.stringify(folderPickerResponseWindows));
        });

        test('check dialog options are set up correctly when choosing file in Linux', async () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            sandbox.stub(serverExplorer, 'quickPickDeploymentType' as any).resolves(deploymentStatus.file);

            const filePickerResponseLinux = {
                canSelectFiles: true,
                canSelectMany: false,
                canSelectFolders: false,
                openLabel: `Select File Deployment`
            };
            const stubDialog = sandbox.stub(window, 'showOpenDialog');
            await serverExplorer.addDeployment(undefined);

            const filePickerResult = stubDialog.getCall(0).args[0];
            expect(JSON.stringify(filePickerResult)).equals(JSON.stringify(filePickerResponseLinux));
        });

        test('check dialog options are set up correctly when choosing folder in Linux', async () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            sandbox.stub(serverExplorer, 'quickPickDeploymentType' as any).resolves(deploymentStatus.exploded);

            const folderPickerResponseLinux: OpenDialogOptions = {
                canSelectFiles: false,
                canSelectMany: false,
                canSelectFolders: true,
                openLabel: `Select Exploded Deployment`
            };
            const stubDialog = sandbox.stub(window, 'showOpenDialog');
            await serverExplorer.addDeployment(undefined);

            const folderPickerResult = stubDialog.getCall(0).args[0];
            expect(JSON.stringify(folderPickerResult)).equals(JSON.stringify(folderPickerResponseLinux));
        });

        test('check dialog options are set up correctly when opening dialog with different OSes (like MAC OS)', async () => {
            Object.defineProperty(process, 'platform', {
                value: 'darwin'
            });
            sandbox.stub(serverExplorer, 'quickPickDeploymentType' as any).resolves('file or exploded');

            const pickerResponseDialog: OpenDialogOptions = {
                canSelectFiles: true,
                canSelectMany: false,
                canSelectFolders: true,
                openLabel: `Select file or exploded Deployment`
            };
            const stubDialog = sandbox.stub(window, 'showOpenDialog');
            await serverExplorer.addDeployment(undefined);

            const pickerResult = stubDialog.getCall(0).args[0];
            expect(JSON.stringify(pickerResult)).equals(JSON.stringify(pickerResponseDialog));
        });

        test('check promise get rejected if os picker is closed without choosing', async () => {
            sandbox.stub(serverExplorer, 'quickPickDeploymentType' as any).resolves(undefined);

            try {
                await serverExplorer.addDeployment(undefined);
                expect.fail();
            } catch (err) {
                expect(err).equals(undefined);
            }
        });

        test('check if user doesn\'t choose any file from dialog', async () => {
            sandbox.stub(window, 'showOpenDialog').resolves(undefined);
            const result = await serverExplorer.addDeployment(undefined);
            expect(result).equals(undefined);
        });

        test('check if user terminate before adding optional deployment parameters', async () => {
            sandbox.stub(window, 'showOpenDialog').resolves([userSelectedPath]);
            sandbox.stub(window, 'showQuickPick').resolves(undefined);
            const result = await serverExplorer.addDeployment(undefined);
            expect(result).equals(undefined);
        });
    });
});
