import * as cp from 'child_process';
import * as findJava from 'find-java-home';
import * as path from 'path';
import * as waitOn from 'wait-on';
import * as vscode from 'vscode';

export interface ConnectionInfo {
    host: string;
    port: number;
}

export function start(context: vscode.ExtensionContext): Promise<ConnectionInfo> {
    return new Promise((resolve, reject) => {
        findJava((err, home) => {
            if (err) {
                reject(err);
            } else {
                const rspserverstdout = vscode.window.createOutputChannel('RSP Server (stdout)');
                const rspserverstderr = vscode.window.createOutputChannel('RSP Server (stderr)');
                context.subscriptions.push(rspserverstdout);
                context.subscriptions.push(rspserverstderr);
                const serverLocation = path.resolve(__dirname, '..', '..', 'server');
                const felix = path.join(serverLocation, 'bin', 'felix.jar');
                const java = path.join(home, 'bin', 'java');
                const rspserver = cp.spawn(java, ['-jar', felix], { cwd: serverLocation });
                waitOn({
                    resources: ['tcp:localhost:27511']
                }, () => {
                    resolve({
                        port: 27511,
                        host: 'localhost'
                    });
                });
                rspserver.stdout.on('data', data => {
                    displayLog(rspserverstdout, data.toString());
                });
                rspserver.stderr.on('data', data => {
                    displayLog(rspserverstderr, data.toString());
                });
            }
        });
    });
}

function displayLog(outputPanel: vscode.OutputChannel, message: string) {
    outputPanel.show();
    outputPanel.appendLine(message);
}
