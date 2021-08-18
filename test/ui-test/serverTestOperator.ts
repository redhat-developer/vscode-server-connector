import { ActivityBar, EditorView, InputBox, WebDriver } from 'vscode-extension-tester';
import { AdaptersConstants } from './common/constants/adaptersContants';
import { ServerState } from './common/enum/serverState';
import { deleteAllServers, serverHasState, stopAllServers } from './common/util/serverUtils';
import { clearNotifications, showErrorNotifications } from './common/util/testUtils';
import { RSPServerProvider } from './server/ui/rspServerProvider';
import { ServersTab } from './server/ui/serversTab';


export class ServerTestOperator {
    private _serversTab: ServersTab;
    private _rspServerProvider: RSPServerProvider;

    public get serversTab(): ServersTab {
        return this._serversTab;
    }

    public get rspServerProvider(): RSPServerProvider {
        return this._rspServerProvider;
    }

    public async openServersSection(): Promise<void> {
        this._serversTab = new ServersTab(await new ActivityBar().getViewControl('Explorer'));
        await this.serversTab.open();
    }

    public async startRSPServerProvider(driver: WebDriver): Promise<RSPServerProvider> {
        if (!this._serversTab) {
            await this.openServersSection();
        }
        this._rspServerProvider = await this._serversTab.getServerProvider(AdaptersConstants.RSP_SERVER_PROVIDER_NAME);
        const state = await this.rspServerProvider.getServerState();
        if (state === ServerState.Unknown || state === ServerState.Starting) {
            await driver.wait(async () => await serverHasState(this.rspServerProvider, ServerState.Started, ServerState.Connected), 15000,
                'Server was not started within 10 s on startup');
        }
        else if (state !== ServerState.Started) {
            await this.rspServerProvider.start(20000);
        }
        return this.rspServerProvider;
    }

    public async cleanUpAll(): Promise<void> {
        // clean up quick box
        try {
            await new InputBox().cancel();
        } catch (error) {
            // no input box, not need to close it
        }
        try {
            await new EditorView().closeAllEditors();
        } catch (error) {
            // no input box, not need to close it
            console.log(error);
        }
        await showErrorNotifications();
        await clearNotifications();
        await stopAllServers(this.rspServerProvider);
        await deleteAllServers(this.rspServerProvider);
        if (await this.rspServerProvider.getServerState() === ServerState.Stopped) {
            await this.rspServerProvider.stop();
        }
    }
}