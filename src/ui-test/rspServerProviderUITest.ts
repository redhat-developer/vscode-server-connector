import { ServersActivityBar } from "./server/ui/serversActivityBar";
import { expect } from 'chai'
import { AdaptersConstants } from "./common/adaptersContants";
import { ServerState } from "./common/serverState";
import { WebDriver, VSBrowser } from "vscode-extension-tester";
import { serverHasState } from "./server/serverUtils";


/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export function rspServerProviderUITest() {
    describe('Verify RSP Server provider default behavior', () => {

        let driver: WebDriver;

        before(() => {
            driver = VSBrowser.instance.driver;
        });

        it('Verify rsp server provider tree item is available', async function() {
            this.timeout(10000);
            const servers = new ServersActivityBar();
            await servers.open();
            const serverProvider = await servers.getServerProvider();
            expect(await serverProvider.getServerName()).to.include(AdaptersConstants.RSP_SERVER_PROVIDER_NAME);
        });


        it('Verify rsp server provider is started on startup', async function() {
            this.timeout(10000);
            const servers = new ServersActivityBar();
            await servers.open();
            const serverProvider = await servers.getServerProvider();
            // initial server provider is starting automatically on bar activation
            // so one of unknown/starting/started is expected
            const serverState = await serverProvider.getServerState();
            expect([ServerState.Unknown, ServerState.Starting, ServerState.Started]).to.include(serverState);
            // wait for server to get started
            try {
                await driver.wait(() => { return serverHasState(serverProvider, ServerState.Started);}, 5000 );
            } catch (error) {
                throw Error(error + ", Expected server provider to have state Started, but got " +  ServerState[await serverProvider.getServerState()]);
            }
        });
    });
}