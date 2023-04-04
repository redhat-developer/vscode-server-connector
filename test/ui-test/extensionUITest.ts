import { AdaptersConstants } from './common/constants/adaptersContants';
import { expect } from 'chai';
import { ActivityBar, By, ExtensionsViewSection, SideBarView, TitleActionButton, ViewControl } from 'vscode-extension-tester';

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export function extensionUIAssetsTest(): void {
    describe('Verify extension\'s base assets available after install', () => {

        let view: ViewControl;
        let sideBar: SideBarView;
        let section: ExtensionsViewSection;

        beforeEach(async function() {
            this.timeout(10000);
            view = await new ActivityBar().getViewControl('Extensions');
            sideBar = await view.openView();
            const content = sideBar.getContent();
            section = await content.getSection('Installed') as ExtensionsViewSection;
        });

        it('Dependent Runtime Server Protocol UI extension is installed', async function() {
            this.timeout(10000);
            const items = await section.getVisibleItems();
            expect(await Promise.all(items.map(item => item.getTitle()))).to.include(AdaptersConstants.RSP_UI_NAME);
        });

        it('Server Connector extension is installed', async function() {
            this.timeout(10000);
            await section.getVisibleItems();
            const items = await section.getVisibleItems();
            expect(await Promise.all(items.map(item => item.getTitle()))).to.include(AdaptersConstants.RSP_CONNECTOR_NAME);
        });

        afterEach(async function() {
            this.timeout(10000);
            if (sideBar && await sideBar.isDisplayed()) {
                sideBar = await (await new ActivityBar().getViewControl('Extensions')).openView();
                const titlePart = sideBar.getTitlePart();
                const actionButton = new TitleActionButton(By.xpath('.//a[@aria-label="Clear Extensions Search Results"]'), titlePart);
                if (actionButton.isEnabled()) {
                    await actionButton.click();
                }
            }
        });

        after(async () => {
            if (sideBar && await sideBar.isDisplayed() && view) {
                await view.closeView();
            }
        });
    });
}
