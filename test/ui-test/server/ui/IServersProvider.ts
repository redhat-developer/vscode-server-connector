import { ViewSection, SideBarView } from 'vscode-extension-tester';

/**
 * Servers provider interface, could be servers activity bar or servers tab
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export interface IServersProvider {
    getServerProviderTreeSection(): Promise<ViewSection>;
    open(): Promise<SideBarView>;
}