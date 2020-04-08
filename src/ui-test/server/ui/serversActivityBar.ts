import { ActivityBar, SideBarView, ViewControl, TitleActionButton, VSBrowser } from 'vscode-extension-tester';
import { AdaptersConstants } from '../../common/adaptersContants';
import { RSPServerProvider } from './rspServerProvider';

/**
 * Servers activity bar representation
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export class ServersActivityBar {

    private viewControl: ViewControl;
    private sideBarView: SideBarView;

    constructor() {
        this.viewControl = new ActivityBar().getViewControl(AdaptersConstants.RSP_CONNECTOR_NAME);
    }

    async getSideBarView(): Promise<SideBarView> {
        if (!this.sideBarView || !(await this.sideBarView.isDisplayed())) {
            throw new Error("Servers side bar was not yet initializaed, call open first");
        }
        return this.sideBarView;
    }
    
    public getViewControl(): ViewControl {
        return this.viewControl;
    }

    async open(): Promise<SideBarView> {
        if (!this.sideBarView) {
            this.sideBarView = await this.viewControl.openView();
        }
        return this.sideBarView;
    }

    async getServerProvider(): Promise<RSPServerProvider> {
        const sections = await (await this.getSideBarView()).getContent().getSections();
        const treeSection = sections[0];
        await VSBrowser.instance.driver.wait(async () => {
            const treeItems = await treeSection.getVisibleItems();
            return  treeItems.length > 0; 
        }, 3000);
        const items = await treeSection.getVisibleItems();
        const filteredItems = await Promise.all(items.filter(async (item) => {
            return (await item.getText()).indexOf(AdaptersConstants.RSP_SERVER_PROVIDER_NAME) >= 0;
        }));
        if (filteredItems.length > 1) {
            throw Error("Unambiguous items found for rsp server provider, should be only one");
        }
        return new RSPServerProvider(filteredItems[0]);
    }

    async getActionButton(): Promise<TitleActionButton> {
        await this.open();
        const titlePart = this.sideBarView.getTitlePart();
        return await titlePart.getAction(AdaptersConstants.RSP_SERVER_PROVIDER_CREATE_NEW_SERVER);
    }
}