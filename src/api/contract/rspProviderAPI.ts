import { RSPState } from '../../serverExplorer';

export interface RSPProviderAPI {
    registerRSPProvider(rsp: RSPState): Promise<void>;
    deregisterRSPProvider(id: string): Promise<void>;
}
