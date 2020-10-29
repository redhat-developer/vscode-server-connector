import { ServerState } from '../enum/serverState';
import { IServer } from '../../server/ui/IServer';
import { RSPServerProvider } from '../../server/ui/rspServerProvider';
import { PublishState } from '../enum/publishState';
import { Server } from '../../server/ui/server';
import { Deployment } from '../../server/ui/deployment';

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export async function serverHasState(server: IServer, ...states: ServerState[]): Promise<boolean> {
    const stateActual = await server.getServerState();
    return states.includes(stateActual);
}

export async function deploymentHasState(deployment: Deployment, ...states: ServerState[]): Promise<boolean> {
    const stateActual = await deployment.getDeploymentState();
    return states.includes(stateActual);
}

export async function serverHasDeployment(server: IServer, deploymentName: string): Promise<boolean> {
    const deployment = await (server as Server).getDeployment(deploymentName);
    return !!deployment;
}

export async function serverHasPublishState(server: Server, ...states: PublishState[]): Promise<boolean> {
    const stateActual = await server.getServerPublishState();
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
        if (await server.getServerState() !== ServerState.Stopped) {
            await server.stop();
        }
    }
}
