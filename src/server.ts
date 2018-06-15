import * as cp from 'child_process';
import * as findJava from 'find-java-home';
import * as path from 'path';
import * as waitOn from 'wait-on';

const isWindows = process.platform.indexOf('win') === 0;
const JAVA_FILENAME = 'java' + (isWindows ? '.exe' : '');

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
                const java = path.join(home, 'bin', JAVA_FILENAME);
                console.log('Servers java location ' + java);
                console.log('Servers felix location ' + felix);
                cp.spawn(java, ['-jar', felix], { cwd: serverLocation });
                waitOn({
                    resources: ['tcp:localhost:27511']
                }, () => {
                    resolve({
                        port: 27511,
                        host: 'localhost'
                    });
                });
            }
        });
    });
}
