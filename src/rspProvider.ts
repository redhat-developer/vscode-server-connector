import * as server from './server';

export class RSPProvider {

    private host: string;
    private port: number;

    constructor() {

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



}