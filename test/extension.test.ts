/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import * as chai from 'chai';
import { ClientStubs } from './clientstubs';
import { activate, deactivate } from '../src/extension';
import { CommandHandler } from '../src/extensionApi';
import { Protocol } from 'rsp-client';
import * as server from '../src/server';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as vscode from 'vscode';

const expect = chai.expect;
chai.use(sinonChai);

// Defines a Mocha test suite to group tests of similar kind together
suite('Extension Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let startStub;
    let stubs: ClientStubs;

    class DummyMemento implements vscode.Memento {
        public get<T>(key: string): Promise<T|undefined> {
            return Promise.resolve(undefined);
        }

        public update(key: string, value: any): Promise<void> {
            return Promise.resolve();
        }
    }

    const context: vscode.ExtensionContext = {
        extensionPath: 'path',
        storagePath: 'string',
        subscriptions: [],
        workspaceState: new DummyMemento(),
        globalState: new DummyMemento(),
        asAbsolutePath(relativePath: string): string {
            return '';
        }
    };

    const serverdata = {
        port: '27511',
        host: 'localhost',
        process: {
            stdout: {
                on: (event: string, callback: (name: string) => void) => {
                    return callback('some output');
                }
            },
            stderr: {
                on: (event: string, callback: (name: string) => void) => {
                    return callback('some error');
                }
            }
        }
    };

    setup(() => {
        sandbox = sinon.createSandbox();

        stubs = new ClientStubs(sandbox);

        startStub = sandbox.stub(server, 'start').resolves(serverdata);

        stubs.outgoing.getServerHandles.resolves([]);
        const capab: Protocol.ServerCapabilitiesResponse = {
            serverCapabilities: {
            },
            clientRegistrationStatus: undefined
        };
        stubs.outgoing.registerClientCapabilities.resolves(capab);
        stubs.incoming.onPromptString.resolves();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('redhat.vscode-server-connector'));
    });

    test('Server is started at extension activation time', async () => {
        sandbox.stub(CommandHandler.prototype, 'activate').resolves();
        const createTreeViewStub = sandbox.stub(vscode.window, 'createTreeView');
        const result = await activate(context);
        expect(startStub).calledOnce;
        expect(result).deep.equals({serverInfo: serverdata});
        expect(createTreeViewStub).calledOnce;
    });

    test('should register all server commands', async () => {
        return await vscode.commands.getCommands(true).then(commands => {
            const SERVER_COMMANDS = [
                'server.start',
                'server.restart',
                'server.debug',
                'server.restartDebug',
                'server.stop',
                'server.terminate',
                'server.remove',
                'server.output',
                `server.addDeployment`,
                'server.removeDeployment',
                'server.publishFull',
                'server.createServer',
                'server.addLocation',
                'server.downloadRuntime',
                'server.infoServer'
            ];
            const foundServerCommands = commands.filter(value => {
                return SERVER_COMMANDS.indexOf(value) >= 0 || value.startsWith('server.');
            });
            const t1 = foundServerCommands.length;
            const t2 = SERVER_COMMANDS.length;
            assert.equal(t1, t2,
                'Some server commands are not registered properly or a new command is not added to the test');
        });
    });

    test('server has been stopped on deactivation', () => {
        deactivate();

        expect(stubs.clientStub.shutdownServer).calledOnce;
    });
});
