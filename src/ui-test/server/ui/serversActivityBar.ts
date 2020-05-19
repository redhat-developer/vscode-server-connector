import { ActivityBar, SideBarView, ViewControl, TitleActionButton, ViewSection, VSBrowser } from 'vscode-extension-tester';
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

    async getServerProviderTreeSection(): Promise<ViewSection> {
        await this.open();
        const sections = await (await this.getSideBarView()).getContent().getSections();
        await VSBrowser.instance.driver.wait(() => { return this.sectionHasItems(sections[0]);}, 3000 );
        return sections[0];
    }

    async getServerProvider(name: string): Promise<RSPServerProvider> {
        await this.open();
        return new RSPServerProvider(this, name);

    }

    async getActionButton(): Promise<TitleActionButton> {
        await this.open();
        const titlePart = this.sideBarView.getTitlePart();
        return await titlePart.getAction(AdaptersConstants.RSP_SERVER_PROVIDER_CREATE_NEW_SERVER);
    }

    async sectionHasItems(section: ViewSection): Promise<boolean> {
        return (await section.getVisibleItems()).length > 0;
    }
}