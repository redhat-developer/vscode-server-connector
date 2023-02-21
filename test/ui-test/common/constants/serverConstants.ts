export interface ServerTestType {
    serverName: string,
    serverDownloadName: string,
    serverInstallationName: string
}

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export class ServersConstants {
    // NEW_SERVER_ADAPTER
    // serverInstallationName is the name of the folder (or a prefix thereof) 
    // that the server will be extracted into.
    public static wf27: ServerTestType = {
        serverName: 'wildfly-27.0.1.Final',
        serverDownloadName: 'WildFly 27.0.1 Final',
        serverInstallationName: 'wildfly-2701final'
    }

    public static eap80: ServerTestType = {
        serverName: 'jboss-eap-8.0',
        serverDownloadName: 'Red Hat JBoss EAP 8.0.0 Beta',
        serverInstallationName: 'jbosseap800'
    }
    /* 
     * Object holding information about pair: server default output name and server download name
    */
   // NEW_SERVER_ADAPTER
    public static readonly WILDFLY_SERVERS = [
        ServersConstants.wf27
    ];

    public static readonly EAP_SERVERS = [
        ServersConstants.eap80
    ];

    public static readonly TEST_SERVERS = [...ServersConstants.WILDFLY_SERVERS, ...ServersConstants.EAP_SERVERS];
}