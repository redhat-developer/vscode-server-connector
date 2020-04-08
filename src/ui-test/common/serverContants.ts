/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export class ServersConstants {

    public static readonly WILDFLY_SERVERS = {
        "wf18": "WildFly 18.0.0.Final"
    };

    public static readonly EAP_SERVERS = {
        "eap72": "Red Hat EAP 7.2.0",
        "eap73": "Red Hat EAP 7.3.0"
    };

    public static readonly TEST_SERVERS = {...ServersConstants.WILDFLY_SERVERS, ...ServersConstants.EAP_SERVERS};
}