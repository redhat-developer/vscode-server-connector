import { extensionUIAssetsTest } from './extensionUITest';
import { rspServerProviderUITest } from './rspServerProviderUITest';
import { rspServerProviderActionsTest } from "./rspServerProviderActionsTest";
import { basicE2ETest } from "./basicServerTest";
import { ServersConstants } from './common/serverConstants';

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
describe('VSCode Server Connector - UI tests', () => {
    extensionUIAssetsTest();
    rspServerProviderUITest();
    rspServerProviderActionsTest();
    basicE2ETest(Object.keys(ServersConstants.TEST_SERVERS));
});
