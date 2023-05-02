/*******************************************************************************
 * Copyright (c) 2021 Red Hat, Inc.
 * Distributed under license by Red Hat, Inc. All rights reserved.
 * This program is made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution,
 * and is available at http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 * Red Hat, Inc. - initial API and implementation
 ******************************************************************************/
import { getRedHatService, TelemetryService } from '@redhat-developer/vscode-redhat-telemetry';
import { ExtensionContext } from 'vscode';

let telemetryService: Promise<TelemetryService>;

export async function initializeTelemetry(context:ExtensionContext) {
    telemetryService = (await getRedHatService(context)).getTelemetryService();
}

export async function getTelemetryServiceInstance(): Promise<TelemetryService> {
    return telemetryService;
}
