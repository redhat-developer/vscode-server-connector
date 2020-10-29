import { ServerState } from "../../common/enum/serverState";

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export interface IServer {

    getServerState(): Promise<ServerState> ;
    getServerName(): Promise<string> ;

    start(): Promise<void>;
    stop(): Promise<void>;
    terminate(): Promise<void>;

    delete(): Promise<void>;
}
