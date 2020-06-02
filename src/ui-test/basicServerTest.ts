import { ServersActivityBar } from "./server/ui/serversActivityBar";
import { WebDriver, VSBrowser, NotificationType, Workbench, InputBox } from "vscode-extension-tester";
import { RSPServerProvider } from "./server/ui/rspServerProvider";
import { serverHasState, stopAllServers, deleteAllServers } from "./common/util/serverUtils";
import { expect } from 'chai';
import * as os from "os";
import { ServerState } from "./common/enum/serverState";
import { AdaptersConstants } from "./common/adaptersContants";
import { ServersConstants } from "./common/serverConstants";
import { downloadServer } from "./common/util/downloadServerUtil";

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export function wildflyE2EBasicTest() {
    describe('Verify that E2E use case scenario for server adapter is working properly', function() {

        let driver: WebDriver;
        let serverProvider: RSPServerProvider;
        let serversActivityBar: ServersActivityBar;

        before(function() {
            if (os.platform() === 'darwin') {
                this.skip();
            }
            driver = VSBrowser.instance.driver;
            serversActivityBar = new ServersActivityBar();
        });

        beforeEach(async function() {
            this.timeout(30000);
            await serversActivityBar.open();
            serverProvider = await serversActivityBar.getServerProvider(AdaptersConstants.RSP_SERVER_PROVIDER_NAME);
            const state = await serverProvider.getServerState();
            if (state == ServerState.Unknown || state == ServerState.Starting)
                await driver.wait(async () => { return await serverHasState(serverProvider, ServerState.Started);}, 10000, 
                "Server was not started within 10 s on startup");
            else if (state != ServerState.Started) {
                await serverProvider.start(10000);
            }
        });

        for(let serverName in ServersConstants.WILDFLY_SERVERS) {
            const serverDownloadName = ServersConstants.WILDFLY_SERVERS[serverName];
            it('Verify ' + serverDownloadName + ' basic features - create server (download), start, restart, stop', async function() {
                this.timeout(240000);
                await downloadServer(serverProvider, serverDownloadName);
                const servers = await serverProvider.getServers();
                const serversNames = await Promise.all(servers.map(async (item) => { return await item.getServerName(); }));
                expect(serversNames).to.include.members([serverName]);
                const server = await serverProvider.getServer(serverName);
                await server.start();
                await server.restart();
                await server.stop();
            });
        }

        afterEach(async function() {
            this.timeout(30000);
            // clean up quick box
            try {
                await new InputBox().cancel();
            } catch (error) {
                // no input box, not need to close it
            }
            // clean up notifications
            const nc = await new Workbench().openNotificationsCenter();
            const notifications = await nc.getNotifications(NotificationType.Any);
            if (notifications.length > 0) {
                await nc.clearAllNotifications();
            }
            await nc.close();
            await stopAllServers(serverProvider);
            await deleteAllServers(serverProvider);
        });
    });
}