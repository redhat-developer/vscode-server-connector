import * as cp from 'child_process';
import * as findJava from 'find-java-home';
import * as path from 'path';
import * as waitOn from 'wait-on';

const portfinder = require('portfinder');

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
                const serverLocation = process.env.RSP_SERVER_LOCATION ? process.env.RSP_SERVER_LOCATION : path.resolve(__dirname, '..', '..', 'server');
                const felix = path.join(serverLocation, 'bin', 'felix.jar');
                const java = path.join(home, 'bin', 'java');
                portfinder.basePort = 27511;
                portfinder.getPortPromise()
                .then(serverport => {
                    const process = cp.spawn(java, [`-Drsp.server.port=${serverport}`, '-jar', felix], { cwd: serverLocation });
                    waitOn({
                        resources: [`tcp:localhost:${serverport}`]
                    }, () => {
                        resolve({
                            port: serverport,
                            host: 'localhost',
                            process
                        });
                    });
                })
                .catch(err => {
                    console.log(err);
                });
            }
        });
    });
}
