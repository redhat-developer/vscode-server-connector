/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as chai from 'chai';
import * as chaipromise from 'chai-as-promised';
import { ClientStubs } from './clientstubs';
import { DebugInfo } from '../src/debugInfo';
import { DebugInfoProvider } from '../src/debugInfoProvider';
import { ProtocolStubs } from './protocolstubs';
import { Protocol } from 'rsp-client';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaipromise);

suite('DebugInfo', () => {
    let sandbox: sinon.SinonSandbox;
    let javaCmdLineStub: Protocol.CommandLineDetails;
    let javaDebugInfo: DebugInfo;
    let typescriptDebugInfo: DebugInfo;
    let emptyDebugInfo: DebugInfo;

    setup(() => {
        sandbox = sinon.createSandbox();

        javaCmdLineStub = {
            cmdLine: [],
            workingDir: '',
            envp: [],
            properties: {
                ['debug.details.type']: 'java',
                ['debug.details.port']: 'javaPort'
            }
        };
        javaDebugInfo = new DebugInfo(javaCmdLineStub);

        typescriptDebugInfo = new DebugInfo({
            cmdLine: [],
            workingDir: '',
            envp: [],
            properties: {
                ['debug.details.type']: 'typescript',
                ['debug.details.port']: 'typescriptPort'
            }
        });

        emptyDebugInfo = new DebugInfo({
            cmdLine: [],
            workingDir: '',
            envp: [],
            properties: {
                ['debug.details.type']: null,
                ['debug.details.port']: null
            }
        });

    });

    teardown(() => {
        sandbox.restore();
    });

    test('Should be java type', () => {
        // given
        // when
        const isJavaType = javaDebugInfo.isJavaType();
        // then
        expect(isJavaType).to.be.true;
    });

    test('Should get java port value', () => {
        // given
        // when
        const port = javaDebugInfo.getPort();
        // then
        expect(port).to.equals('javaPort');
    });

    test('Typescript should not be java type', () => {
        // given
        // when
        const isJavaType = typescriptDebugInfo.isJavaType();
        // then
        expect(isJavaType).to.be.false;
    });

    test('Empty should not be java type', () => {
        // given
        // when
        const isJavaType = emptyDebugInfo.isJavaType();
        // then
        expect(isJavaType).to.be.false;
    });

    test('Should get null port value', () => {
        // given
        // when
        const port = emptyDebugInfo.getPort();
        // then
        expect(port).to.equals(null);
    });

    test('Should retrieve java debug info', () => {
        // given
        const stubs: ClientStubs = new ClientStubs(sandbox);
        stubs.outgoing.getLaunchCommand.resolves(javaCmdLineStub);

        // when
        const debugInfo: Thenable<DebugInfo> = DebugInfoProvider.retrieve(ProtocolStubs.serverHandle, stubs.client);

        // then
        debugInfo.then(javaInfo => {
            expect(javaInfo.isJavaType()).to.equals(true);
        });
    });

});
