import { ActivityBar, SideBarView, ViewControl, TitleActionButton, ViewSection, VSBrowser } from 'vscode-extension-tester';
import { AdaptersConstants } from '../../common/adaptersContants';
import { RSPServerProvider } from './rspServerProvider';
import { sectionHasItem } from '../../common/util/testUtils';

/**
 * Servers tab representation
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export class ServersTab {

    private viewControl: ViewControl;
    private sideBarView: SideBarView;

    constructor() {
        this.viewControl = new ActivityBar().getViewControl('Explorer');
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
        const sideBarView = await this.getSideBarView();
        await this.collapseAllSections('Servers');
        await VSBrowser.instance.driver.wait( async () => await sectionHasItem(sideBarView, 'Servers'), 3000 );
        const section = await sideBarView.getContent().getSection('Servers');
        await section.expand();
        return section;
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

    private async collapseAllSections(exceptSection?: string): Promise<void> {
        const sections = await (await this.getSideBarView()).getContent().getSections();
        for (let section of sections) {
            if (await section.isExpanded() && await section.getTitle() != exceptSection) {
                await section.collapse();
            }
        }
    }
}