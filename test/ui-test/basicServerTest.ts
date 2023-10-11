import { WebDriver, VSBrowser, NotificationType } from 'vscode-extension-tester';
import { RSPServerProvider } from './server/ui/rspServerProvider';
import { serverHasState } from './common/util/serverUtils';
import { expect } from 'chai';
import * as os from 'os';
import { ServerState } from './common/enum/serverState';
import { Unpack } from './common/util/unpack';
// import { downloadExtractFile } from './common/util/downloadServerUtil';

import * as fs from 'fs';
import path = require('path');

import { clearNotifications, getNotifications } from './common/util/testUtils';
import { Logger } from 'tslog';
import { ServerTestOperator } from './serverTestOperator';
import { ServerTestType } from './common/constants/serverConstants';

const log: Logger = new Logger({ name: 'basicE2ETest'});
/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export function basicServerOperationTest(testServers: ServerTestType[]): void {
    describe('Perform E2E test scenario for server adapters', () => {

        let driver: WebDriver;
        // NEW_SERVER_ADAPTER
        // const EAP_URL = 'https://download-node-02.eng.bos.redhat.com/released/jboss/eap8/8.0.0-Beta/jboss-eap-8.0.0.Beta.zip';
        const downloadLocation = path.join(__dirname, 'eap-server.zip');
        const extractLocation = path.join(__dirname, 'eap-server');

        before(function() {
            if (os.platform() === 'darwin') {
                this.skip();
            }
            driver = VSBrowser.instance.driver;
        });

        for (const testServer of testServers) {
            describe(`Verify ${testServer.serverDownloadName} basic features - create server (download), start, restart, stop`, () => {

                const serverOperator = new ServerTestOperator();
                let serverProvider: RSPServerProvider;

                before(async function() {
                    this.timeout(40000);
                    await clearNotifications();
                    await serverOperator.openServersSection();
                    serverProvider = await serverOperator.startRSPServerProvider(driver);
                });

                if (testServer.serverDownloadName.indexOf('WildFly') >= 0) {
                    it(`Download and create the ${testServer.serverDownloadName} server`, async function() {
                        this.timeout(150000);
                        await serverProvider.createDownloadServer(testServer.serverDownloadName);
                        const servers = await serverProvider.getServers();
                        const serversNames = await Promise.all(servers.map(async item => await item.getServerName()));
                        expect(serversNames).to.include.members([testServer.serverName]);
                    });
                } else {
                    it(`Create the ${testServer.serverDownloadName} server from the disk location`, async function() {
                        this.timeout(240000);
                        log.info(`Extracting downloaded EAP server from ${downloadLocation} to ${extractLocation}`);

                        // Download is in the Jenkinsfile. Server is pre-downloaded.
                        expect(fs.existsSync(downloadLocation)).to.be.true;
                        if (!fs.existsSync(extractLocation)) {
                            // await downloadExtractFile(EAP_URL, downloadLocation, extractLocation);
                            await Unpack.unpack(downloadLocation, extractLocation);
                        }
                        expect(fs.existsSync(extractLocation)).to.be.true;

                        try {
                            const realPath = path.join(extractLocation, testServer.serverName);
                            log.info(`Adding new local server at ${realPath}`);
                            await serverProvider.createLocalServer(realPath, testServer.serverName, true);
                        } catch (error) {
                            // verify no error notification appeared
                            const errors = await getNotifications(NotificationType.Error);
                            if (errors && errors.length > 0) {
                                const report = errors.map(async error => {
                                    return `${await error.getSource()} ${await error.getMessage()} \r\n`;
                                });
                                error.message += `${error.message} Error notification(s) also appeared during creating local server adapter: ${report}`;
                            }
                            throw error;
                        }
                        const servers = await serverProvider.getServers();
                        const serversNames = await Promise.all(servers.map(async item =>  await item.getServerName()));
                        expect(serversNames).to.include.members([testServer.serverName]);
                    });
                }
                it('Start the server', async function() {
                    this.timeout(30000);
                    const server = await serverProvider.getServer(testServer.serverName);
                    await server.start();
                    await driver.wait(async () => await serverHasState(server, ServerState.Started), 3000);
                });

                it('Restart the server', async function() {
                    this.timeout(40000);
                    const server = await serverProvider.getServer(testServer.serverName);
                    await server.restart();
                    await driver.wait(async () => await serverHasState(server, ServerState.Started), 3000);
                });
                it('Stop the server', async function() {
                    this.timeout(20000);
                    const server = await serverProvider.getServer(testServer.serverName);
                    await server.stop();
                    await driver.wait(async () => await serverHasState(server, ServerState.Stopped), 3000);
                });
                it('Delete the server', async function() {
                    this.timeout(20000);
                    const server = await serverProvider.getServer(testServer.serverName);
                    await server.delete();
                    const servers = await serverProvider.getServers();
                    const serversNames = await Promise.all(servers.map(async item => await item.getServerName()));
                    expect(serversNames).to.not.include.members([testServer.serverName]);
                });
                after(async function() {
                    this.timeout(30000);
                    await serverOperator.cleanUpAll();
                });
            });
        }
    });
}
