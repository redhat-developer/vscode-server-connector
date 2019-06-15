import * as server from './server';

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

    public async startRSP(stdoutCallback: (server: string, data: string) => void, stderrCallback: (server: string, data: string) => void ): Promise<server.ServerInfo>  {
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

    public getName(): string {
        return this.name;
    }

}
