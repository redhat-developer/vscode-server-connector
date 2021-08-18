import { extensionUIAssetsTest } from './extensionUITest';
import { rspServerProviderUITest } from './rspServerProviderUITest';
import { rspServerProviderActionsTest } from './rspServerProviderActionsTest';
import { basicServerOperationTest } from './basicServerTest';
import { deploymentE2ETest } from './advancedServerTest';
import { ServersConstants } from './common/constants/serverConstants';

import { advancedServerOperationTest } from './advancedServerOperationTest';

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
describe('VSCode Server Connector - UI tests', () => {
    extensionUIAssetsTest();
    rspServerProviderUITest();
    rspServerProviderActionsTest();
    basicServerOperationTest(ServersConstants.TEST_SERVERS);
    deploymentE2ETest(ServersConstants.WILDFLY_SERVERS);
    advancedServerOperationTest(ServersConstants.WILDFLY_SERVERS);
});
