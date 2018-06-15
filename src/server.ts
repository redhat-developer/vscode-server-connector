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
                let serverLocation = path.resolve(__dirname, '..', 'server');
                let felix = path.join(serverLocation, 'bin', 'felix.jar');
                let java = path.join(home, 'bin', 'java.exe');
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
