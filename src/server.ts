import * as cp from 'child_process';
import * as findJava from 'find-java-home';
import * as path from 'path';
import * as waitOn from 'wait-on';

export interface ServerInfo {
    host: string;
    port: number;
    process: cp.ChildProcess;
}

export function start(): Promise<ServerInfo> {
    return new Promise((resolve, reject) => {
        findJava((err, home) => {
            if (err) {
                reject(err);
            } else {
                const serverLocation = path.resolve(__dirname, '..', '..', 'server');
                const felix = path.join(serverLocation, 'bin', 'felix.jar');
                const java = path.join(home, 'bin', 'java');
                const process = cp.spawn(java, ['-jar', felix], { cwd: serverLocation });
                waitOn({
                    resources: ['tcp:localhost:27511']
                }, () => {
                    resolve({
                        port: 27511,
                        host: 'localhost',
                        process
                    });
                });
            }
        });
    });
}
