import { AdaptersConstants } from './common/adaptersContants';
import { expect } from 'chai';
import { ActivityBar, ExtensionsViewItem, ExtensionsViewSection, SideBarView, ViewControl } from 'vscode-extension-tester';

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export function extensionUIAssetsTest() {
    describe('Verify extension\'s base assets available after install', () => {

        let view: ViewControl;
        let sideBar: SideBarView;

        beforeEach(async function() {
            this.timeout(4000);
            view = new ActivityBar().getViewControl('Extensions');
            sideBar = await view.openView();
        });

        it('Dependent Remote Server Protocol UI extension is installed', async function() {
            this.timeout(5000);
            const section = await sideBar.getContent().getSection('Installed') as ExtensionsViewSection;
            const item = await section.findItem(`@installed ${AdaptersConstants.RSP_UI_NAME}`) as ExtensionsViewItem;
            expect(item).not.undefined;
        });

        it('Server Connector extension is installed', async function() {
            this.timeout(5000);
            const section = await sideBar.getContent().getSection('Installed') as ExtensionsViewSection;
            const item = await section.findItem(`@installed ${AdaptersConstants.RSP_CONNECTOR_NAME}`) as ExtensionsViewItem;
            expect(item).not.undefined;
        });

        afterEach(async function() {
            this.timeout(10000);
            if (sideBar && await sideBar.isDisplayed()) {
                sideBar = await new ActivityBar().getViewControl('Extensions').openView();
                const titlePart = sideBar.getTitlePart();
                const actionButton = await titlePart.getAction('Clear Extensions Search Results');
                if (actionButton.isEnabled()) {
                    await actionButton.click();
                }
            }
        });

        after(async () => {
            if (sideBar && await sideBar.isDisplayed()) {
                await view.closeView();
            }
        });
    });
}
