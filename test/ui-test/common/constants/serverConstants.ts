/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export class ServersConstants {

    /* 
     * Object holding information about pair: server default output name and server download name
    */
    public static readonly WILDFLY_SERVERS = {
        'wildfly-21.0.2.Final': 'WildFly 21.0.2 Final'
    };

    public static readonly EAP_SERVERS = {
        'jboss-eap-7.3.0': 'Red Hat JBoss EAP 7.3.0'
    };

    public static readonly TEST_SERVERS = {...ServersConstants.WILDFLY_SERVERS, ...ServersConstants.EAP_SERVERS};
}