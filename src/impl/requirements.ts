/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as cp from 'child_process';
import { ChildProcess } from 'child_process';
import * as expandHomeDir from 'expand-home-dir';
import * as findJavaHome from 'find-java-home';
import * as path from 'path';
import * as pathExists from 'path-exists';
import { Uri, workspace } from 'vscode';

const isWindows = process.platform.indexOf('win') === 0;
const JAVAC_FILENAME = 'javac' + (isWindows ? '.exe' : '');
const JAVA_FILENAME = 'java' + (isWindows ? '.exe' : '');

export interface RequirementsResult {
    data?: RequirementsData;
    rejection?: RspRequirementsRejection;
    unexpectedError?: any;
}

export interface RequirementsData {
    java_home: string;
    java_version: number;
}

export interface ErrorMsgBtn {
    label: string;
    openUrl?: Uri | undefined;
}

export interface RspRequirementsRejection {
    rspReqReject: boolean,
    message: string,
    label: string,
    openUrl: Uri,
    replaceClose: boolean,
    btns: ErrorMsgBtn[]
}

/**
 * Resolves the requirements needed to run the extension.
 * Returns a promise that will resolve to a RequirementsData if
 * all requirements are resolved, it will reject with ErrorData if
 * if any of the requirements fails to resolve.
 */
export async function resolveRequirements(minJavaVersion: number): Promise<RequirementsResult> {
    try {
        const ret: RequirementsResult = await resolveRequirementsImpl(minJavaVersion);
        return Promise.resolve(ret);
    } catch( err ) {
        const ret: RequirementsResult = {
            unexpectedError: err
        };
        return Promise.resolve(ret);
    }
}

export async function resolveRequirementsImpl(minJavaVersion: number): Promise<RequirementsResult> {
    const javaHome: string | RspRequirementsRejection = await checkJavaRuntime();
    if( (javaHome as any).rspReqReject) {
        return {rejection: javaHome as RspRequirementsRejection};
    }
    const javaHome2: string = javaHome as string;
    const javaVersion: number | RspRequirementsRejection = await checkJavaVersion(javaHome2, minJavaVersion);
    if( (javaVersion as any).rspReqReject) {
        return {rejection: javaVersion as RspRequirementsRejection};
    }
    const javaVersion2: number = javaVersion as number;
    const data: RequirementsData = { java_home: javaHome2, java_version: javaVersion2}
    return {data: data};
}

async function checkJavaRuntime(): Promise<string | RspRequirementsRejection> {
    let source: string;
    let javaHome: string | undefined = readJavaConfig();
    if (javaHome) {
        source = 'The rsp-ui.rsp.java.home variable defined in VS Code settings';
    } else {
        javaHome = process.env.JDK_HOME;
        if (javaHome) {
            source = 'The JDK_HOME environment variable';
        } else {
            javaHome = process.env.JAVA_HOME;
            source = 'The JAVA_HOME environment variable';
        }
    }
    if (javaHome) {
        javaHome = expandHomeDir(javaHome) as string;
        if (!pathExists.sync(javaHome)) {
            return getRejectionWithDownloadUrl(`${source} points to a missing folder`);
        }
        if (!pathExists.sync(path.resolve(javaHome, 'bin', JAVAC_FILENAME))) {
            return getRejectionWithDownloadUrl(`${source} does not point to a JDK. The '${JAVAC_FILENAME}' command is missing.`);
        }
        return javaHome;
    }
    // No settings, let's try to detect as last resort.
    const ret1 = await new Promise<string | RspRequirementsRejection>((resolve, reject) => {
        findJavaHome((err: Error, home: string | PromiseLike<string>) => {
            if (err) {
                resolve(getRejectionWithDownloadUrl('Java runtime could not be located'));
            } else {
                resolve(home);
            }
        });    
    });
    return ret1;
}
function readJavaConfig(): string | undefined {
    const config = workspace.getConfiguration();
    const ret = config.get<string | undefined>('rsp-ui.rsp.java.home', undefined);
    if(ret)
        return ret;
    // Backwards compatibility
    return config.get<string | undefined>('java.home', undefined);
}

async function checkJavaVersion(javaHome: string, minJavaVersion: number): 
    Promise<number | RspRequirementsRejection> {

    const javaExecutable = path.resolve(javaHome, 'bin', JAVA_FILENAME);
    let ret: undefined | number | RspRequirementsRejection;
    const process: ChildProcess = cp.execFile(javaExecutable, ['-version'], {}, (error, stdout, stderr) => {
        const javaVersion = parseMajorVersion(stderr);
        if (!javaVersion) {
            ret = getRejectionWithDownloadUrl(`Java ${minJavaVersion} or newer is required. No Java was found on your system.
            Please get a recent JDK or configure it for "Servers View" if it already exists`);
        } else if (javaVersion < minJavaVersion) {
            ret = getRejectionWithDownloadUrl(`Java ${minJavaVersion} or newer is required. Java ${javaVersion} was found at ${javaHome}.
            Please get a recent JDK or configure it for "Servers View" if it already exists`);
        } else {
            ret = javaVersion;
        }
    });
    
    let allDone = false;
    process.on('exit', function() {
        allDone = true;
      });
    const start = Date.now();
    const max = 10000;
    const end = start + max;
    let expired = false;
    while( !allDone && !expired) {
        await new Promise(resolve => setTimeout(resolve, 250));
        expired = Date.now() > end;
    }
    if( !ret && expired) {
        try {
            if( process )
                process.kill();
        } catch( e ) {
        }
        const msg = "Error getting java version for " + javaExecutable + ": 'java -version' did not return within " + (max/1000) + " seconds."
        return getRejectionWithDownloadUrl(msg);
    }
    if( !ret ) {
        const msg = "Error getting java version for " + javaExecutable + ": 'java -version' output was unable to be parsed.";
        return getRejectionWithDownloadUrl(msg);
    }
    return ret;
}

export function parseMajorVersion(content: string): number {
    let regexp = /version "(.*)"/g;
    let match = regexp.exec(content);
    if (!match) {
        return undefined;
    }
    let version = match[1];
    // Ignore '1.' prefix for legacy Java versions
    if (version.startsWith('1.')) {
        version = version.substring(2);
    }

    // look into the interesting bits now
    regexp = /\d+/g;
    match = regexp.exec(version);
    let javaVersion = 0;
    if (match) {
        javaVersion = parseInt(match[0], 10);
    }
    return javaVersion;
}

const newLocal = 'https://developers.redhat.com/products/openjdk/download/?sc_cid=701f2000000RWTnAAO';
function getRejectionWithDownloadUrl(message: string): RspRequirementsRejection {
    let jdkUrl = newLocal;
    if (process.platform === 'darwin') {
        jdkUrl = 'http://www.oracle.com/technetwork/java/javase/downloads/index.html';
    }
    const rejectVal: RspRequirementsRejection = {
        rspReqReject: true,
        message: message,
        label: 'Get the Java Development Kit',
        openUrl: Uri.parse(jdkUrl),
        replaceClose: false,
        btns: [
            {
                label: 'Get the Java Development Kit',
                openUrl: Uri.parse(jdkUrl),
            },
            {
                label: 'Configure Java'
            }
        ]
    }
    return rejectVal;
}
