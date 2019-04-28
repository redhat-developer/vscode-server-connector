/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { Protocol } from 'rsp-client';
import { ServerIcon } from '../src/serverIcon';
import { Uri } from 'vscode';

const expect = chai.expect;

suite('Server Icons', () => {

    const unknownServer: Protocol.ServerType = {
        id: 'unknown',
        visibleName: 'unknown server',
        description: 'unknown server'
    };

    const eap71Server: Protocol.ServerType = {
        id: 'org.jboss.ide.eclipse.as.eap.71',
        visibleName: undefined,
        description: undefined
    };

    test('null server type gets a null icon', () => {
        // when
        const defaultIcon: Uri = ServerIcon.get(null);
        // then
        expect(defaultIcon).to.be.null;
    });

    test('unknown server type gets a default icon', () => {
        // when
        const defaultIcon: Uri = ServerIcon.get(unknownServer);
        // then
        expect(defaultIcon).not.to.be.null;
    });

    test('known server type gets an icon that is not the default icon', () => {
        // given
        const defaultIcon: Uri = ServerIcon.get(unknownServer);
        // when
        const icon: Uri = ServerIcon.get(eap71Server);
        // then
        expect(icon).not.to.be.null;
        expect(icon).not.to.be.equal(defaultIcon);
    });

});
