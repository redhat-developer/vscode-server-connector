import { extensionUIAssetsTest } from './extensionUITest';
import { rspServerProviderUITest } from './rspServerProviderUITest';
import { rspServerProviderActionsTest } from "./rspServerProviderOperationsTest";

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
describe('VSCode RSP UI - UI tests', () => {
    extensionUIAssetsTest();
    rspServerProviderUITest();
    rspServerProviderActionsTest();
});
