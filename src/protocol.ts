import { NotificationType, RequestType0, RequestType1 } from 'vscode-jsonrpc';
/* tslint:disable */
// Generated using typescript-generator version 2.2.413 on 2018-06-11 23:06:18.
/* tslint:disable */
// Generated using typescript-generator version 2.2.413 on 2018-06-13 15:30:13.

export interface Attribute {
    type: string;
    description: string;
    defaultVal: any;
}

export interface Attributes {
    attributes: { [index: string]: Attribute };
}

export interface CommandLineDetails {
    cmdLine: string[];
    workingDir: string;
    envp: string[];
    properties: { [index: string]: string };
}

export interface DiscoveryPath {
    filepath: string;
}

export interface LaunchAttributesRequest {
    id: string;
    mode: string;
}

export interface LaunchParameters {
    mode: string;
    params: ServerAttributes;
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
    type: ServerType;
}

export interface ServerLaunchMode {
    mode: string;
    desc: string;
}

export interface ServerProcess {
    server: ServerHandle;
    processId: string;
}

export interface ServerProcessOutput {
    server: ServerHandle;
    processId: string;
    streamType: number;
    text: string;
}

export interface ServerStartingAttributes {
    initiatePolling: boolean;
    request: LaunchParameters;
}

export interface ServerStateChange {
    server: ServerHandle;
    state: number;
}

export interface ServerType {
    id: string;
    visibleName: string;
    description: string;
}

export interface StartServerResponse {
    status: Status;
    details: CommandLineDetails;
}

export interface Status {
    severity: number;
    code: number;
    message: string;
    trace: string;
    ok: boolean;
    plugin: string;
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
    export const type = new RequestType1<ServerAttributes, Status, void, void>('server/createServer');
}

export namespace GetRequiredAttributesRequest {
    export const type = new RequestType1<ServerType, ServerAttributes, void, void>('server/getRequiredAttributes');
}

export namespace GetOptionalAttributesRequest {
    export const type = new RequestType1<ServerType, ServerAttributes, void, void>('server/getOptionalAttributes');
}

export namespace GetServerHandlersRequest {
    export const type = new RequestType0<Array<ServerHandle>, void, void>('server/getServerHandles');
}

export namespace DeleteServerNotification {
    export const type = new NotificationType<ServerHandle, void>('server/deleteServer');
}

export namespace StartServerAsyncRequest {
    export const type = new RequestType1<LaunchParameters, StartServerResponse, void, void>('server/startServerAsync');
}

export namespace StopServerAsyncRequest {
    export const type = new RequestType1<StopServerAttributes, Status, void, void>('server/stopServerAsync');
}

export namespace ServerStateChangeNotification {
    export const type = new NotificationType<ServerStateChange, void>('client/serverStateChanged');
}

export namespace ServerProcessOutputAppendedNotification {
    export const type = new NotificationType<ServerProcessOutput, void>('client/serverProcessOutputAppended');
}