import { WebDriver, VSBrowser, NotificationType, Workbench, InputBox } from "vscode-extension-tester";
import { RSPServerProvider } from "./server/ui/rspServerProvider";
import { serverHasState } from "./common/util/serverUtils";
import { expect } from 'chai'
import { fail } from "assert";
import * as os from "os";
import { AdaptersConstants } from "./common/constants/adaptersContants";
import { ServersConstants } from "./common/constants/serverConstants";
import { ServerState } from "./common/enum/serverState";
import { downloadableListIsAvailable } from "./common/util/downloadServerUtil";
import { ServersTab } from "./server/ui/serversTab";
import { notificationExistsWithObject, showErrorNotifications } from "./common/util/testUtils";


const ERROR_CREATE_NEW_SERVER = 'Unable to create the server';
const ERROR_NO_RSP_PROVIDER = 'there are no rsp providers to choose from';
const YES = 'Yes';
const USE_FROM_DISK = 'No, use server on disk';

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export function rspServerProviderActionsTest() {
    describe('Verify RSP Server provider actions', () => {

        let driver: WebDriver;
        let serverProvider: RSPServerProvider;
        let serversTab: ServersTab;

        before(function() {
            if (os.platform() === 'darwin') {
                this.skip();
            }
            driver = VSBrowser.instance.driver;
            serversTab = new ServersTab();
        });

        beforeEach(async function() {
            this.timeout(30000);
            await serversTab.open();
            serverProvider = await serversTab.getServerProvider(AdaptersConstants.RSP_SERVER_PROVIDER_NAME);
            const state = await serverProvider.getServerState();
            if (state === ServerState.Unknown || state === ServerState.Starting) {
                await driver.wait(async () => await serverHasState(serverProvider, ServerState.Started), 15000 , 'Server was not started within 15 s on startup');
            }
            else if (state !== ServerState.Started) {
                await serverProvider.start(20000);
            }
        });

        it('Verify rsp server provider operation - Create New Server', async function() {
            this.timeout(20000);
            const quick = await serverProvider.getCreateNewServerBox();
            const options = await quick.getQuickPicks();
            expect(await Promise.all(options.map(async item => await item.getText()))).to.have.members([YES, USE_FROM_DISK]);
            await quick.selectQuickPick(YES);
            await driver.wait( async () =>  await downloadableListIsAvailable(quick), 10000 );
            const input = await InputBox.create();
            await input.setText('WildFly 20');
            const optionsText = await Promise.all((await input.getQuickPicks()).map(async item => await item.getText()));
            await input.clear();
            await input.setText('Red Hat EAP');
            optionsText.push(...(await Promise.all((await input.getQuickPicks()).map(async item => await item.getText()))));
            expect(optionsText).to.include.members(Object.keys(ServersConstants.TEST_SERVERS).map(key => ServersConstants.TEST_SERVERS[key]));
            await quick.cancel();
        });

        it('Verify rsp server provider operation - stop', async function() {
            this.timeout(20000);
            await serverProvider.stop();
        });

        it('Verify rsp server provider behavior - cannot create new server on stopped rsp provider', async function() {
            this.timeout(20000);
            await serverProvider.stop();
            // normally we would be expecting input box to appear
            await serverProvider.createNewServerCommand();
            let notification;
            try {
                notification = await driver.wait(async () => await notificationExistsWithObject(ERROR_CREATE_NEW_SERVER), 3000 );
            } catch (error) {
                console.log(error);
                const nc = await new Workbench().openNotificationsCenter();
                fail('Failed to obtain Create new server warning notification, available notifications are: '
                + (await Promise.all((await nc.getNotifications(NotificationType.Any)).map(async item => await item.getText()))));
            }
            expect(await notification.getType()).equals(NotificationType.Warning);
            expect(await notification.getMessage()).to.include(ERROR_NO_RSP_PROVIDER);
        });

        it('Verify rsp server provider operation - terminate', async function() {
            this.timeout(20000);
            await serverProvider.terminate();
        });

        afterEach(async function() {
            this.timeout(10000);
            // clean up quick box
            try {
                await new InputBox().cancel();
            } catch (error) {
                // no input box, not need to close it
            }
            await showErrorNotifications();
            // clean up notifications
            const nc = await new Workbench().openNotificationsCenter();
            const notifications = await nc.getNotifications(NotificationType.Any);
            if (notifications.length > 0) {
                await nc.clearAllNotifications();
            }
            await nc.close();
        });

        after(async function() {
            this.timeout(20000);
            // Check error messages if any
            await showErrorNotifications();
            const tab = new ServersTab();
            await tab.open();
            const provider = await tab.getServerProvider(AdaptersConstants.RSP_SERVER_PROVIDER_NAME);
            const state = await provider.getServerState();
            if (![ServerState.Stopped, ServerState.Stopping].includes(state)) {
                provider.stop(10000);
            }
        });
    });
}
