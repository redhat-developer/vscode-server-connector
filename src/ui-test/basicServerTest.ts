import { WebDriver, VSBrowser, NotificationType, Workbench, InputBox } from "vscode-extension-tester";
import { RSPServerProvider } from "./server/ui/rspServerProvider";
import { serverHasState, stopAllServers, deleteAllServers } from "./common/util/serverUtils";
import { expect } from 'chai';
import * as os from "os";
import { ServerState } from "./common/enum/serverState";
import { AdaptersConstants } from "./common/adaptersContants";
import { downloadExtractFile, createDownloadServer, createLocalServer } from "./common/util/downloadServerUtil";
import { ServersTab } from "./server/ui/serversTab";

import * as fs from 'fs';
import path = require('path');
import { getNotifications, showErrorNotifications } from "./common/util/testUtils";
import { ServersConstants } from "./common/serverConstants";

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export function basicE2ETest(testServers: string[]) {
    describe('Perform E2E test scenario for server adapters', () => {

        let driver: WebDriver;
        const EAP_URL = 'http://download-node-02.eng.bos.redhat.com/released/jboss/eap7/7.3.0/jboss-eap-7.3.0.zip';
        const downloadLocation = path.join(__dirname, 'eap-server.zip');
        const extractLocation = path.join(__dirname, 'eap-server');

        before(function() {
            if (os.platform() === 'darwin') {
                this.skip();
            }
            driver = VSBrowser.instance.driver;
        });

        for (const serverName of testServers) {
            const serverDownloadName = ServersConstants.TEST_SERVERS[serverName];
            describe(`Verify ${serverDownloadName} basic features - create server (download), start, restart, stop`, () => {

                let serverProvider: RSPServerProvider;
                let serversTab: ServersTab;

                before(async function() {
                    this.timeout(40000);
                    serversTab = new ServersTab();
                    await serversTab.open();
                    serverProvider = await serversTab.getServerProvider(AdaptersConstants.RSP_SERVER_PROVIDER_NAME);
                    const state = await serverProvider.getServerState();
                    if (state === ServerState.Unknown || state === ServerState.Starting) {
                        await driver.wait(async () => await serverHasState(serverProvider, ServerState.Started), 15000,
                        'Server was not started within 10 s on startup');
                    }
                    else if (state !== ServerState.Started) {
                        await serverProvider.start(20000);
                    }
                });

                if (serverDownloadName.indexOf('WildFly') >= 0) {
                    it(`Download and create the ${serverDownloadName} server`, async function() {
                        this.timeout(150000);
                        await createDownloadServer(serverProvider, serverDownloadName);
                        const servers = await serverProvider.getServers();
                        const serversNames = await Promise.all(servers.map(async item => await item.getServerName()));
                        expect(serversNames).to.include.members([serverName]);
                    });
                } else {
                    it(`Create the ${serverDownloadName} server from the disk location`, async function() {
                        this.timeout(240000);
                        await downloadExtractFile(EAP_URL, downloadLocation, extractLocation);
                        expect(fs.existsSync(extractLocation)).to.be.true;
                        try {
                            const realPath = path.join(extractLocation, 'jboss-eap-7.3');
                            console.log(`Create server on location: ${realPath}, path exists: ${fs.existsSync(realPath)}`);
                            await createLocalServer(serverProvider, realPath, serverName);
                        } catch (error) {
                            // verify no error notification appeared
                            const errors = await getNotifications(NotificationType.Error);
                            if (errors && errors.length > 0) {
                                const report = errors.map(async error => {
                                    return `${await error.getSource()} ${await error.getMessage()} \r\n`;
                                });
                                error.message = `${error.message} Error appeared during creating local server adapter: ${report}`;
                                throw error;
                            }
                        }
                        const servers = await serverProvider.getServers();
                        const serversNames = await Promise.all(servers.map(async item =>  await item.getServerName()));
                        expect(serversNames).to.include.members([serverName]);
                    });
                }
                it('Start the server', async function() {
                    this.timeout(20000);
                    const server = await serverProvider.getServer(serverName);
                    await server.start();
                    await driver.wait( async () => await serverHasState(server, ServerState.Started), 3000 );
                });

                it('Restart the server', async function() {
                    this.timeout(30000);
                    const server = await serverProvider.getServer(serverName);
                    await server.restart();
                    await driver.wait( async () => await serverHasState(server, ServerState.Started), 3000 );
                });
                it('Stop the server', async function() {
                    this.timeout(20000);
                    const server = await serverProvider.getServer(serverName);
                    await server.stop();
                    await driver.wait( async () => await serverHasState(server, ServerState.Stopped), 3000 );
                });
                it('Delete the server', async function() {
                    this.timeout(20000);
                    const server = await serverProvider.getServer(serverName);
                    await server.delete();
                    const servers = await serverProvider.getServers();
                    const serversNames = await Promise.all(servers.map(async item => await item.getServerName()));
                    expect(serversNames).to.not.include.members([serverName]);
                });
                after(async function() {
                    this.timeout(30000);
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
                    await stopAllServers(serverProvider);
                    await deleteAllServers(serverProvider);
                });
            });
        }
    });
}
