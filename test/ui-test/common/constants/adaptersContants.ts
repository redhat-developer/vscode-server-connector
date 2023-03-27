/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export class AdaptersConstants {

    // General
    public static readonly YES = 'Yes';
    public static readonly NO = 'No';
    public static readonly LICENSE_EDITOR = 'workflow.license';

    // RSP extensions properties
    public static readonly RSP_UI_NAME = 'Runtime Server Protocol UI';
    public static readonly RSP_CONNECTOR_NAME = 'Server Connector';
    public static readonly RSP_COMMAND = 'Servers:';
    public static readonly RSP_SERVERS_LABEL = 'Servers';
    public static readonly RSP_ATIVITY_BAR_TITLE = 'SERVER CONNECTOR: SERVERS';
    public static readonly CONTINUE_LICENSE = 'Continue...';
    public static readonly AGREE_LICENSE = 'Yes (True)';
    public static readonly DISAGREE_LICENSE = 'No (False)';
    public static readonly RSP_DOWNLOADING_NOTIFICATION = 'Job Download runtime:';

    // RSP server provider constants
    public static readonly RSP_SERVER_PROVIDER_NAME = 'Red Hat Server Connector';
    public static readonly RSP_SERVER_PROVIDER_CREATE_NEW_SERVER = 'Create New Server...';
    public static readonly RSP_SERVER_PROVIDER_START = 'Start / Connect to RSP Provider';
    public static readonly RSP_SERVER_PROVIDER_STOP = 'Stop RSP Provider';
    public static readonly RSP_SERVER_PROVIDER_DISCONNECT = 'Disconnect from RSP Provider';
    public static readonly RSP_SERVER_PROVIDER_TERMINATE = 'Terminate RSP Provider';

    // Server adapters constants
    public static readonly SERVER_START = 'Start Server';
    public static readonly SERVER_STOP = 'Stop Server';
    public static readonly SERVER_TERMINATE = 'Terminate Server';
    public static readonly SERVER_RESTART_RUN = 'Restart in Run Mode';
    public static readonly SERVER_RESTART_DEBUG = 'Restart in Debug Mode';
    public static readonly SERVER_DEBUG = 'Debug Server';
    public static readonly SERVER_REMOVE = 'Remove Server';
    public static readonly SERVER_ADD_DEPLOYMENT = 'Add Deployment';
    public static readonly SERVER_PUBLISH_FULL = 'Publish Server (Full)';
    public static readonly SERVER_PUBLISH_INCREMENTAL = 'Publish Server (Incremental)';
    public static readonly SERVER_OUTPUT_CHANNEL = 'Show Output Channel';
    public static readonly SERVER_ACTIONS = 'Server Actions...';
    public static readonly SERVER_EDIT = 'Edit Server';
    public static readonly SERVER_DEPLOYMENT_FILE = 'File';
    public static readonly SERVER_DEPLOYMENT_EXPLODED = 'Exploded';
    public static readonly SERVER_ACTION_SHOW_IN_BROWSER = 'Show in browser...';
    public static readonly SERVER_ACTION_EDIT_CONFIGURATION = 'Edit Configuration File...';

    // Deployment specific
    public static readonly DEPLOYMENT_REMOVE = 'Remove Deployment';
}
