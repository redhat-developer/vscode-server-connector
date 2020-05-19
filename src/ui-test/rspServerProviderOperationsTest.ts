import { ServersActivityBar } from "./server/ui/serversActivityBar";
import { ServerState } from "./common/serverState";
import { WebDriver, VSBrowser, NotificationType, Workbench, InputBox } from "vscode-extension-tester";
import { RSPServerProvider } from "./server/ui/rspServerProvider";
import { notificationExists, serverHasState } from "./server/serverUtils";
import { expect } from 'chai'
import { fail } from "assert";
import * as os from "os";
import { AdaptersConstants } from "./common/adaptersContants";


const ERROR_CREATE_NEW_SERVER = 'Unable to create the server';
const ERROR_NO_RSP_PROVIDER = 'there are no rsp providers to choose from';
const YES = 'Yes';
const USE_FROM_DISK = 'No, use server on disk';

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export function rspServerProviderActionsTest() {
    describe('Verify RSP Server provider actions', function() {

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
                await driver.wait(async () => { return await serverHasState(serverProvider, ServerState.Started);}, 10000 , "Server was not started within 10 s on startup");
            else if (state != ServerState.Started) {
                await serverProvider.startServerProvider(10000);
            }
        });

        it('Verify rsp server provider operation - stop', async function() {
            this.timeout(8000);
            await serverProvider.stopServerProvider();
        });


        it('Verify rsp server provider operation - terminate', async function() {
            this.timeout(8000);
            await serverProvider.terminateServerProvider();
        });

        it('Verify rsp server provider operation - Create New Server', async function() {
            this.timeout(8000);
            const quick = await serverProvider.getCreateNewServerBox();
            const options = await quick.getQuickPicks();
            expect(await Promise.all(options.map(async (item) => await item.getText()))).to.have.members([YES, USE_FROM_DISK]);
            await quick.cancel();
        });

        it('Verify rsp server provider behavior - cannot create new server on stopped rsp provider', async function() {
            this.timeout(10000);
            await serverProvider.stopServerProvider();
            // normally we would be expecting input box to appear
            await serverProvider.createNewServerCommand();
            let notification;
            try { 
                notification = await driver.wait(() => { return notificationExists(ERROR_CREATE_NEW_SERVER);}, 3000 );
            } catch (error) {
                console.log(error);
                const nc = await new Workbench().openNotificationsCenter();
                fail('Failed to obtain Create new server warning notification, available notifications are: ' 
                + (await nc.getNotifications(NotificationType.Any)).map(async (item) => await item.getText()));
            }
            expect(await notification.getType()).equals(NotificationType.Warning);
            expect(await notification.getMessage()).to.include(ERROR_NO_RSP_PROVIDER);
        });

        afterEach(async function() {
            this.timeout(10000);
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
        })
    });
}