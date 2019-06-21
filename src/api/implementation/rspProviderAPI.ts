import { API } from '../contract/api';
import { available } from '../implementation/apiUtils';
import { RSPProviderAPI } from "../contract/rspProviderAPI";
import { RSPProperties, RSPState, ServerExplorer } from "../../serverExplorer";
import * as vscode from 'vscode';

export function api(): API<RSPProviderAPI> {
    return available(impl());
}

export function impl(): RSPProviderAPI {
    return new RSPProviderAPIImpl();
}

class RSPProviderAPIImpl implements RSPProviderAPI {
    constructor() {}

    async registerRSPProvider(rsp: RSPState): Promise<void> {
        let error: string;
        if (!rsp) {
            error = 'Unable to register RSP provider - RSP state is not valid.';
            vscode.window.showErrorMessage(error);
            return Promise.reject(error);
        }
    
        if (!rsp.type || !rsp.type.id) {
            error = 'Unable to register RSP provider - Id is not valid.';
            vscode.window.showErrorMessage(error);
            return Promise.reject(error);
        }
    
        const rspserverstdout = vscode.window.createOutputChannel(`${rsp.type.visibilename} (stdout)`);
        const rspserverstderr = vscode.window.createOutputChannel(`${rsp.type.visibilename} (stderr)`);
    
        const rspProperties: RSPProperties = {
            state: rsp,
            client: undefined,
            rspserverstderr: rspserverstderr,
            rspserverstdout: rspserverstdout
        };
        const serversExplorer = ServerExplorer.getInstance();
        serversExplorer.RSPServersStatus.set(rsp.type.id, rspProperties);
        serversExplorer.initTreeRsp();
    }
    
    async deregisterRSPProvider(id: string): Promise<void> {
        if (!id) {
            const error = 'Unable to remove RSP provider - Id is not valid.';
            vscode.window.showErrorMessage(error);
            return Promise.reject(error);
        }
        const serversExplorer = ServerExplorer.getInstance();
        serversExplorer.RSPServersStatus.get(id).rspserverstdout.dispose();
        serversExplorer.RSPServersStatus.get(id).rspserverstderr.dispose();
        serversExplorer.RSPServersStatus.delete(id);
    }
    
}