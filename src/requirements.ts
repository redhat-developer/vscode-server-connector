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
            source = 'The java.home variable defined in VS Code settings';
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
                rejectWithDownloadUrl(reject, `${source} does not point to a JDK.`);
            }
            return resolve(javaHome);
        }
        // No settings, let's try to detect as last resort.
        findJavaHome((err: any, home: string | PromiseLike<string>) => {
            if (err) {
                rejectWithDownloadUrl(reject, 'Java runtime could not be located');
            } else {
                resolve(home);
            }
        });
    });
}

function readJavaConfig(): string {
    const config = workspace.getConfiguration();
    return config.get<string>('java.home', '');
}

function checkJavaVersion(javaHome: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const javaExecutable = path.resolve(javaHome, 'bin', JAVA_FILENAME);
        cp.execFile(javaExecutable, ['-version'], {}, (error, stdout, stderr) => {
            const javaVersion = parseMajorVersion(stderr);
            if (javaVersion < 8) {
                rejectWithDownloadUrl(reject, `Java 8 or newer is required to run this extension.
                Java ${javaVersion} was found at ${javaHome}. Please download and install a recent JDK`);
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
        return 0;
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
    (reason?: any): void;
    (reason?: any): void;
    (reason?: any): void;
    (reason?: any): void;
    (arg0: {
        message: string;
        label: string;
        openUrl: Uri;
        replaceClose: boolean;
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
        replaceClose: false
    });
}
