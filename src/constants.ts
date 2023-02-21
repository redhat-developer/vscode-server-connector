/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { Uri } from "vscode";
import { FelixRspLauncherOptions } from "./server";

/**
 * RSP Provider ID
 */
const RSP_PROVIDER_ID = 'redhat.vscode-server-connector';
/**
 * RSP Provider Name - it will be displayed in the tree node
 */
const RSP_PROVIDER_NAME = 'Red Hat Server Connector';

/**
 * The provider id to be used in the .rsp folder
 */
const RSP_ID = 'redhat-server-connector';

/**
 * The minimum port for this rsp instance to avoid clobbering
 */
const RSP_MIN_PORT = 8500;
/**
 * The maximum port for this rsp instance to avoid clobbering
 */
const RSP_MAX_PORT = 8999;
/**
 * How long to wait before trying to connect
 */
const RSP_CONNECTION_DELAY = 1500;
/**
 * How frequently to attempt to connect after launch
 */
const RSP_CONNECTION_POLL_INTERVAL = 500;

export const getImageFilenameForServerType = (serverType: string): string => {
    if (serverType.startsWith('org.jboss.ide.eclipse.as.7')) {
        return 'jbossas7_ligature.svg';
    } else if (serverType.startsWith('org.jboss.ide.eclipse.as.wildfly.')) {
        return 'wildfly_icon.svg';
    } else if (serverType.startsWith('org.jboss.ide.eclipse.as.eap.')) {
        return 'jboss.eap.png';
    } else if (serverType.startsWith('org.jboss.tools.openshift.cdk.server.type')) {
        return 'Logotype_RH_OpenShift.svg';
    } else {
        return 'server-light.png';
    }
}

export const OPTIONS: FelixRspLauncherOptions = {
    providerId: RSP_PROVIDER_ID,
    providerName: RSP_PROVIDER_NAME,
    rspId: RSP_ID,
    minPort: RSP_MIN_PORT,
    maxPort: RSP_MAX_PORT,
    connectionDelay: RSP_CONNECTION_DELAY,
    connectionPollFrequency: RSP_CONNECTION_POLL_INTERVAL,
    minimumSupportedJava: 11,
    getImagePathForServerType: function (serverType: string): Uri {
        const tmpPath: string = getImageFilenameForServerType(serverType);
        if( tmpPath )
            return Uri.file(path.join(__dirname, '..', '..', 'images', tmpPath));
        return null;
    }
}
