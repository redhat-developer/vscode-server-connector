import * as server from './server';

export class RSPProvider {

    constructor(private host: string, private port: string) {

    }

    public async startRSP(stdoutCallback: (data: string) => void, stderrCallback: (data: string) => void ): Promise<server.ServerInfo>  {
        return await server.start(stdoutCallback, stderrCallback);
    }

    public async stopRSP() {

    }

    public getHost() {
        return this.host;
    }

    public getPort() {
        return this.port;
    }



}