export interface ServerTestType {
    serverName: string,
    serverDownloadName: string,
    serverInstallationName: string
}

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export class ServersConstants {
    
    public static wf25: ServerTestType = {
        serverName: 'wildfly-25.0.1.Final',
        serverDownloadName: 'WildFly 25.0.1 Final',
        serverInstallationName: 'wildfly-2501final'
    }

    public static wf26: ServerTestType = {
        serverName: 'wildfly-26.1.0.Final',
        serverDownloadName: 'WildFly 26.1.0 Final',
        serverInstallationName: 'wildfly-2610final'
    }

    public static eap74: ServerTestType = {
        serverName: 'jboss-eap-7.4.0',
        serverDownloadName: 'Red Hat JBoss EAP 7.4.0',
        serverInstallationName: 'jbosseap-740'
    }
    /* 
     * Object holding information about pair: server default output name and server download name
    */
    public static readonly WILDFLY_SERVERS = [
        ServersConstants.wf26
    ];

    public static readonly EAP_SERVERS = [
        ServersConstants.eap74
    ];

    public static readonly TEST_SERVERS = [...ServersConstants.WILDFLY_SERVERS, ...ServersConstants.EAP_SERVERS];
}