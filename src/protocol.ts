import { NotificationType, RequestType0, RequestType1 } from 'vscode-jsonrpc';

export interface CreateServerAttribute {
    type: string;
    description: string;
    defaultVal: any;
}

export interface CreateServerAttributes {
    attributes: { [index: string]: CreateServerAttribute };
}

export interface CreateServerAttribute {
    type: string;
    description: string;
    defaultVal: any;
}

export interface DiscoveryPath {
    filepath: string;
}

export interface ServerAttributes {
    serverType: string;
    id: string;
    attributes: { [index: string]: any };
}

export interface ServerBean {
    location: string;
    typeCategory: string;
    specificType: string;
    name: string;
    version: string;
    fullVersion: string;
    serverAdapterTypeId: string;
}

export interface ServerHandle {
    id: string;
    type: string;
}

export interface ServerProcess {
    server: ServerHandle;
    processId: string;
}

export interface ServerHandle {
    id: string;
    type: string;
}

export interface ServerProcessOutput {
    server: ServerHandle;
    processId: string;
    streamType: number;
    text: string;
}

export interface ServerHandle {
    id: string;
    type: string;
}

export interface ServerStateChange {
    server: ServerHandle;
    state: number;
}

export interface ServerHandle {
    id: string;
    type: string;
}

export interface ServerType {
    id: string;
}

export interface StartServerAttributes {
    id: string;
    mode: string;
}

export interface Status {
    severity: number;
    code: number;
    message: string;
    trace: string;
    plugin: string;
    ok: boolean;
}

export interface StopServerAttributes {
    id: string;
    force: boolean;
}

export interface VMDescription {
    id: string;
    installLocation: string;
    version: string;
}

export interface VMHandle {
    id: string;
}

export namespace AddDiscoveryPathNotification {
    export const type = new NotificationType<DiscoveryPath, void>('server/addDiscoveryPath');
}

export namespace DiscoveryPathAddedNotification {
    export const type = new NotificationType<DiscoveryPath, void>('client/discoveryPathAdded');
}

export namespace ServerAddedNotification {
    export const type = new NotificationType<ServerHandle, void>('client/serverAdded');
}

export namespace ServerRemovedNotification {
    export const type = new NotificationType<ServerHandle, void>('client/serverRemoved');
}

export namespace GetDiscoveryPathsRequest {
    export const type = new RequestType0<Array<DiscoveryPath>, void, void>('server/getDiscoveryPaths');
}

export namespace FindServerBeansRequest {
    export const type = new RequestType1<DiscoveryPath, Array<ServerBean>, void, void>('server/findServerBeans');
}

export namespace CreateServerRequest {
    export const type = new RequestType1<CreateServerAttributes, Status, void, void>('server/createServer');
}

export namespace GetRequiredAttributesRequest {
    export const type = new RequestType1<ServerType, CreateServerAttributes, void, void>('server/getRequiredAttributes');
}

export namespace GetOptionalAttributesRequest {
    export const type = new RequestType1<ServerType, CreateServerAttributes, void, void>('server/getOptionalAttributes');
}

export namespace GetServerHandlersRequest {
    export const type = new RequestType0<Array<ServerHandle>, void, void>('server/getServerHandles');
}

export namespace DeleteServerNotification {
    export const type = new NotificationType<ServerHandle, void>('server/deleteServer');
}

export namespace StartServerAsyncNotification {
    export const type = new NotificationType<StartServerAttributes, void>('server/startServerAsync');
}

export namespace StopServerAsyncNotification {
    export const type = new NotificationType<StopServerAttributes, void>('server/stopServerAsync');
}

export namespace ServerStateChangeNotification {
    export const type = new NotificationType<ServerStateChange, void>('client/serverStateChanged');
}