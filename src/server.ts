import * as cp from 'child_process';
import * as findJava from 'find-java-home';
import * as path from 'path';
import * as waitOn from 'wait-on';

export interface ConnectionInfo {
    host: string;
    port: number;
}

export function start(): Promise<ConnectionInfo> {
    return new Promise((resolve, reject) => {
        findJava((err, home) => {
            if (err) {
                reject(err);
            } else {
                const serverLocation = path.resolve(__dirname, '..', 'server');
                const felix = path.join(serverLocation, 'bin', 'felix.jar');
                const java = path.join(home, 'bin', 'java');
                const sspserver = cp.spawn(java, ['-jar', felix], { cwd: serverLocation });
                waitOn({
                    resources: ['tcp:localhost:27511']
                }, () => {
                    resolve({
                        port: 27511,
                        host: 'localhost'
                    });
                });
                sspserver.stdout.on('data', data => {
                    return `${data}`;
                });
            }
        });
    });
}
