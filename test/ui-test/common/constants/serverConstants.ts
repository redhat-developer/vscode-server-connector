export interface ServerTestType {
    serverName: string,
    serverDownloadName: string,
    serverInstallationName: string
};

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export class ServersConstants {
    
    public static wf22: ServerTestType = {
        serverName: 'wildfly-22.0.1.Final',
        serverDownloadName: 'WildFly 22.0.1 Final',
        serverInstallationName: 'wildfly-2201final'
    }

    public static wf23: ServerTestType = {
        serverName: 'wildfly-23.0.2.Final',
        serverDownloadName: 'WildFly 23.0.2 Final',
        serverInstallationName: 'wildfly-2302final'
    }

    public static eap73: ServerTestType = {
        serverName: 'jboss-eap-7.3.0',
        serverDownloadName: 'Red Hat JBoss EAP 7.3.0',
        serverInstallationName: 'jbosseap-730'
    }
    /* 
     * Object holding information about pair: server default output name and server download name
    */
    public static readonly WILDFLY_SERVERS = [
        ServersConstants.wf23
    ];

    public static readonly EAP_SERVERS = [
        ServersConstants.eap73
    ];

    public static readonly TEST_SERVERS = [...ServersConstants.WILDFLY_SERVERS, ...ServersConstants.EAP_SERVERS];
}