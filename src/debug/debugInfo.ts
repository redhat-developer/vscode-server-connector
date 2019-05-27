/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Protocol } from 'rsp-client';

export class DebugInfo {

    constructor(private readonly details: Protocol.CommandLineDetails) {
    }

    public isJavaType(): boolean {
        return this.getType()
            && this.getType().indexOf('java') >= 0;
    }

    public getType(): string {
        return this.getDetailsProperty('debug.details.type');
    }

    public getPort(): string {
        return this.getDetailsProperty('debug.details.port');
    }

    private getDetailsProperty(identifier: string) {
        if (!this.details) {
            return null;
        }
        return this.details.properties[identifier];
    }
}
