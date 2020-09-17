import { ServerState } from '../enum/serverState';
import { IServer } from '../../server/ui/IServer';
import { RSPServerProvider } from '../../server/ui/rspServerProvider';

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export async function serverHasState(server: IServer, ...states: ServerState[]): Promise<boolean> {
    const stateActual = await server.getServerState();
    return states.includes(stateActual);
}

export async function serverStateChanged(server: IServer, state: ServerState): Promise<boolean> {
    const stateActual = await server.getServerState();
    return state !== stateActual;
}

export async function deleteAllServers(rsp: RSPServerProvider): Promise<void> {
    const servers = await rsp.getServers();
    for (const server of servers) {
        await server.delete();
    }
}

export async function stopAllServers(rsp: RSPServerProvider): Promise<void> {
    const servers = await rsp.getServers();
    for (const server of servers) {
        await server.stop();
    }
}

