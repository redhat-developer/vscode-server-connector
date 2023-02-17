/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as cp from 'child_process';
import * as expandHomeDir from 'expand-home-dir';
import * as findJavaHome from 'find-java-home';
import * as path from 'path';
import * as pathExists from 'path-exists';
import { Uri, workspace } from 'vscode';

const isWindows = process.platform.indexOf('win') === 0;
const JAVAC_FILENAME = 'javac' + (isWindows ? '.exe' : '');
const JAVA_FILENAME = 'java' + (isWindows ? '.exe' : '');

export interface RequirementsData {
    java_home: string;
    java_version: number;
}

interface ErrorMsgBtn {
    label: string;
    openUrl: Uri | undefined;
}

/**
 * Resolves the requirements needed to run the extension.
 * Returns a promise that will resolve to a RequirementsData if
 * all requirements are resolved, it will reject with ErrorData if
 * if any of the requirements fails to resolve.
 */
export async function resolveRequirements(): Promise<RequirementsData> {
    const javaHome = await checkJavaRuntime();
    const javaVersion = await checkJavaVersion(javaHome);
    return Promise.resolve({ java_home: javaHome, java_version: javaVersion});
}

function checkJavaRuntime(): Promise<string> {
    return new Promise((resolve, reject) => {
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
                rejectWithDownloadUrl(reject, `${source} points to a missing folder`);
            }
            if (!pathExists.sync(path.resolve(javaHome, 'bin', JAVAC_FILENAME))) {
                rejectWithDownloadUrl(reject, `${source} does not point to a JDK. The '${JAVAC_FILENAME}' command is missing.`);
            }
            return resolve(javaHome);
        }
        // No settings, let's try to detect as last resort.
        findJavaHome((err: Error, home: string | PromiseLike<string>) => {
            if (err) {
                rejectWithDownloadUrl(reject, 'Java runtime could not be located');
            } else {
                resolve(home);
            }
        });
    });
}

function readJavaConfig(): string | undefined {
    const config = workspace.getConfiguration();
    const ret = config.get<string | undefined>('rsp-ui.rsp.java.home', undefined);
    if(ret)
        return ret;
    // Backwards compatibility
    return config.get<string | undefined>('java.home', undefined);
}

function checkJavaVersion(javaHome: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const javaExecutable = path.resolve(javaHome, 'bin', JAVA_FILENAME);
        cp.execFile(javaExecutable, ['-version'], {}, (error, stdout, stderr) => {
            const javaVersion = parseMajorVersion(stderr);
            if (!javaVersion) {
                rejectWithDownloadUrl(reject, `Java 11 or newer is required. No Java was found on your system.
                Please get a recent JDK or configure it for "Servers View" if it already exists`);
            } else if (javaVersion < 11) {
                rejectWithDownloadUrl(reject, `Java 11 or newer is required. Java ${javaVersion} was found at ${javaHome}.
                Please get a recent JDK or configure it for "Servers View" if it already exists`);
            } else {
                resolve(javaVersion);
            }
        });
    });
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
function rejectWithDownloadUrl(reject: {
    (reason?: unknown): void;
    (arg0: {
        message: string;
        btns: ErrorMsgBtn[];
    }): void;
}, message: string): void {
    let jdkUrl = newLocal;
    if (process.platform === 'darwin') {
        jdkUrl = 'http://www.oracle.com/technetwork/java/javase/downloads/index.html';
    }
    reject({
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
    });
}
