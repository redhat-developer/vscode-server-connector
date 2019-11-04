/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as cp from 'child_process';
import * as path from 'path';
import * as portfinder from 'portfinder';
import * as requirements from './requirements';
import { ExtensionAPI } from './extensionApi';
import { ServerInfo, ServerState } from 'vscode-server-connector-api';
import * as vscode from 'vscode';

import * as waitOn from 'wait-on';

let cpProcess: cp.ChildProcess;
let javaHome: string;
let port: number;

const rspid: string = "redhat-server-connector";
export function start(stdoutCallback: (data: string) => void, 
                      stderrCallback: (data: string) => void,
                      api: ExtensionAPI ): Promise<ServerInfo> {
    return requirements.resolveRequirements()
    .catch(error => {
      // show error
        vscode.window.showErrorMessage(error.message, error.label)
        .then(selection => {
            if (error.label && error.label === selection && error.openUrl) {
                vscode.commands.executeCommand('vscode.open', error.openUrl);
            }
        });
      // rethrow to disrupt the chain.
        throw error;
    })
    .then(requirements => {
        javaHome = requirements.java_home;
        const options: portfinder.PortFinderOptions = {
            startPort: 8500,
            stopPort: 9000
        };
        return portfinder.getPortPromise(options);
    })
    .then(serverPort => {
        port = serverPort;
        const serverLocation = getServerLocation(process);
        startServer(serverLocation, serverPort, javaHome, stdoutCallback, stderrCallback, api);
      // return  new Promise(resolve=>{
      //  setTimeout(resolve, 5000)
      // });
        return waitOn({ resources: [`tcp:localhost:${serverPort}`] });
    })
    .then(() => {
        if (!port) {
            return Promise.reject('Could not allocate a port for the rsp server to listen on.');
        } else {
            return Promise.resolve({
                port: port,
                host: 'localhost'
            });
        }
    })
    .catch(error => {
        console.log(error);
        return Promise.reject(error);
    });
}

function getServerLocation(process: any): string {
    return  process.env.RSP_SERVER_LOCATION ?
    process.env.RSP_SERVER_LOCATION : path.resolve(__dirname, '..', '..', 'server');
}

function startServer(location: string, port: number, javaHome: string, 
                stdoutCallback: (data: string) => void, stderrCallback: (data: string) => void,
                api: ExtensionAPI): void {
    const felix = path.join(location, 'bin', 'felix.jar');
    const java = path.join(javaHome, 'bin', 'java');
    // Debuggable version
    // const process = cp.spawn(java, [`-Xdebug`, `-Xrunjdwp:transport=dt_socket,server=y,address=8001,suspend=y`, `-Drsp.server.port=${port}`, '-jar', felix], { cwd: location });
    // Production version
    cpProcess = cp.spawn(java, [`-Drsp.server.port=${port}`, `-Dorg.jboss.tools.rsp.id=${rspid}`, '-jar', felix], { cwd: location });
    cpProcess.stdout.on('data', stdoutCallback);
    cpProcess.stderr.on('data', stderrCallback);
    cpProcess.on('close', (code) => {
        if( api != null )
            api.updateRSPStateChanged(ServerState.STOPPED);
    });
    cpProcess.on('exit', (code) => {
        if( api != null )
            api.updateRSPStateChanged(ServerState.STOPPED);
    });
}

export async function terminate(): Promise<void> {
    try {
        if (!cpProcess) {
            cpProcess.removeAllListeners();
            cpProcess.kill();
        }
    } catch (err) {
        return Promise.reject(err);
    }
}
