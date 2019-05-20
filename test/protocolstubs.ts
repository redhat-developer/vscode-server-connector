/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Protocol } from 'rsp-client';

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
        state: 0
    };

    public static readonly status: Protocol.Status = {
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

}
