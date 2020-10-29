import { extensionUIAssetsTest } from './extensionUITest';
import { rspServerProviderUITest } from './rspServerProviderUITest';
import { rspServerProviderActionsTest } from "./rspServerProviderActionsTest";
import { basicE2ETest } from "./basicServerTest";
import { advancedE2ETest } from './advancedServerTest';
import { ServersConstants } from './common/constants/serverConstants';

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
describe('VSCode Server Connector - UI tests', () => {
    extensionUIAssetsTest();
    rspServerProviderUITest();
    rspServerProviderActionsTest();
    basicE2ETest(Object.keys(ServersConstants.TEST_SERVERS));
    advancedE2ETest(Object.keys(ServersConstants.WILDFLY_SERVERS));
});
