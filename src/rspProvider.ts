import * as server from './server';
import { RSPState } from './serverExplorer';

export class RSPProvider {

    private host: string;
    private port: number;
    private name: string;
    private id: string;

    constructor() {
        this.id = 'sample.extensionid';
        this.name = 'RSP Server (Wildfly, Eap, Minishift)'; // to be removed
        // this.name = vscode.env.appName; to be tested
    }

    public async startRSP(stdoutCallback: (data: string) => void, stderrCallback: (data: string) => void ): Promise<server.ServerInfo>  {
        return await server.start(stdoutCallback, stderrCallback).then(serverInfo => {
            this.host = serverInfo.host;
            this.port = serverInfo.port;
            return serverInfo;
        });
    }

    public async stopRSP() {

    }

    public getHost(): string {
        return this.host;
    }

    public getPort(): number {
        return this.port;
    }

    public getId(): string {
        return this.id;
    }

    public getName(): string {
        return this.name;
    }

    public getState(): RSPState {
        return {
            state: 2,
            type: {
                id: this.id,
                visibilename: this.name
            },
            serverStates: undefined
        };
    }

}
