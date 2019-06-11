/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Protocol, ServerState } from 'rsp-client';

export class ProtocolStubs {

    public static readonly serverType: Protocol.ServerType = {
        id: 'type',
        description: 'a type',
        visibleName: 'the type'
    };

    public static readonly serverHandle: Protocol.ServerHandle = {
        id: 'id',
        type: ProtocolStubs.serverType
    };

    public static readonly serverState: Protocol.ServerState =  {
        server: ProtocolStubs.serverHandle,
        deployableStates: [],
        publishState: 0,
        runMode: ServerState.RUN_MODE_RUN,
        state: 0
    };

    public static readonly serverDebuggingState: Protocol.ServerState =  {
        server: ProtocolStubs.serverHandle,
        deployableStates: [],
        publishState: 0,
        runMode: ServerState.RUN_MODE_DEBUG,
        state: 2
    };

    public static readonly okStatus: Protocol.Status = {
        code: 0,
        message: 'ok',
        severity: 0,
        ok: true,
        plugin: 'unknown',
        trace: ''
    };

    public static readonly errorStatus: Protocol.Status = {
        code: 0,
        message: 'Critical Error',
        ok: false,
        plugin: 'plugin',
        severity: 4,
        trace: ''
    };

    public static readonly processOutput: Protocol.ServerProcessOutput = {
        processId: 'process id',
        server: ProtocolStubs.serverHandle,
        streamType: 0,
        text: 'the type'
    };

    public static readonly cmdDetails: Protocol.CommandLineDetails = {
        cmdLine: [''],
        envp: [],
        properties: {},
        workingDir: 'dir'
    };

    public static readonly okStartServerResponse: Protocol.StartServerResponse = {
        details: ProtocolStubs.cmdDetails,
        status: ProtocolStubs.okStatus
    };

    public static readonly unknownServerState: Protocol.ServerState =  {
        server: ProtocolStubs.serverHandle,
        deployableStates: [],
        publishState: ServerState.PUBLISH_STATE_UNKNOWN,
        runMode: ServerState.RUN_MODE_RUN,
        state: ServerState.UNKNOWN
    };

    public static readonly startedServerState: Protocol.ServerState = {
        deployableStates: [],
        publishState: ServerState.PUBLISH_STATE_UNKNOWN,
        server: ProtocolStubs.serverHandle,
        runMode: ServerState.RUN_MODE_RUN,
        state: ServerState.STARTED
    };

    public static readonly stoppedServerState: Protocol.ServerState = {
        deployableStates: [],
        publishState: ServerState.PUBLISH_STATE_UNKNOWN,
        server: ProtocolStubs.serverHandle,
        runMode: ServerState.RUN_MODE_RUN,
        state: ServerState.STOPPED
    };

    public static readonly javaCommandLine: Protocol.CommandLineDetails = {
        cmdLine: [],
        workingDir: '',
        envp: [],
        properties: {
            ['debug.details.type']: 'java',
            ['debug.details.port']: 'javaPort'
        }
    };

}
