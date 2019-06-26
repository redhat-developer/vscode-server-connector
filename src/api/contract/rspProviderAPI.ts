import { RSPType } from '../../serverExplorer';

export interface RSPServer {
    type: RSPType;
    state: number;
}

export interface RSPProviderAPI {
    registerRSPProvider(rsp: RSPServer): Promise<void>;
    deregisterRSPProvider(id: string): Promise<void>;
}
