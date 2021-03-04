import { expect } from 'chai';
import * as os from "os";
import { RSPServerProvider } from "./server/ui/rspServerProvider";
import { ServersTab } from "./server/ui/serversTab";
import { ServerState } from "./common/enum/serverState";
import { deleteAllServers, deploymentHasState, serverHasDeployment, serverHasPublishState, serverHasState, stopAllServers } from "./common/util/serverUtils";
import { ActivityBar, EditorView, InputBox, VSBrowser, WebDriver } from "vscode-extension-tester";
import { clearNotifications, showErrorNotifications } from "./common/util/testUtils";
import { ServersConstants } from "./common/constants/serverConstants";
import { AdaptersConstants } from './common/constants/adaptersContants';
import { PublishState } from './common/enum/publishState';
import { downloadFile } from './common/util/downloadServerUtil';
import { Deployment } from './server/ui/deployment';
import { Logger } from 'tslog';

import path = require('path');
import fs = require('fs');

const log: Logger = new Logger({ name: 'advancedE2ETest'});
/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export function advancedE2ETest(testServers: string[]) {
    describe('Perform advanced E2E test scenario for server adapters - deployments', () => {

        let driver: WebDriver;

        before(function() {
            if (os.platform() === 'darwin') {
                this.skip();
            }
            driver = VSBrowser.instance.driver;
        });

        for (const wfServerName of testServers) {
            const wfServerDownloadName = ServersConstants.TEST_SERVERS[wfServerName];
            describe(`Verify ${wfServerDownloadName} advanced features - deployments`, () => {

                let serverProvider: RSPServerProvider;
                let serversTab: ServersTab;
                const appPath = path.join(__dirname, '../../../test/resources/test-app.war');
                const appName = 'test-app.war';

                before(async function() {
                    this.timeout(240000);
                    await new EditorView().closeAllEditors();
                    serversTab = new ServersTab(await new ActivityBar().getViewControl('Explorer'));
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
                    await serverProvider.createDownloadServer(wfServerDownloadName);
                    const servers = await serverProvider.getServers();
                    const serversNames = await Promise.all(servers.map(async item => await item.getServerName()));
                    expect(serversNames).to.include.members([wfServerName]);
                    const server = await serverProvider.getServer(wfServerName);
                    await server.start();
                    await driver.wait( async () => await serverHasState(server, ServerState.Started), 3000 );
                });

                it(`Add new deployment to the ${wfServerDownloadName} server`, async function() {
                    this.timeout(30000);
                    const server = await serverProvider.getServer(wfServerName);
                    await server.addFileDeployment(appPath);
                    await driver.wait(async () => await serverHasDeployment(server, appName), 8000,
                    'Deployment was not added to the server');
                    const deployment = await server.getDeployment(appName);
                    expect(deployment).to.be.an.instanceof(Deployment);
                    expect(await deployment.getDeploymentPublishState()).to.be.oneOf([PublishState.PUBLISH_REQUIRED, PublishState.SYNCHRONIZED]);
                    await driver.wait(async () =>
                        await deploymentHasState(deployment, ServerState.Unknown, ServerState.Started),
                        3000,
                        'Deployment was not in unknown or started state');
                    expect(await server.getServerPublishState()).to.be.oneOf([PublishState.FULL_PUBLISH_REQUIRED, PublishState.SYNCHRONIZED]);
                });

                it(`Perform full publish of the server`, async function() {
                    this.timeout(15000);
                    const server = await serverProvider.getServer(wfServerName);
                    const deployment = await server.getDeployment(appName);
                    expect(deployment).to.be.an.instanceof(Deployment);
                    await server.publishFull();
                    await driver.wait( async () => await serverHasPublishState(server, PublishState.SYNCHRONIZED), 3000 );
                    expect(await deployment.getDeploymentState()).to.equal(ServerState.Started);
                    expect(await deployment.getDeploymentPublishState()).to.equal(PublishState.SYNCHRONIZED);
                });

                it(`Verify deployment shows up in server actions - Show in browser`, async function() {
                    this.timeout(20000);
                    const server = await serverProvider.getServer(wfServerName);
                    const actions = await Promise.all((await server.getServerActions()));
                    expect(actions).to.include(AdaptersConstants.SERVER_ACTION_SHOW_IN_BROWSER);
                    let inputShow;
                    try {
                        await server.callServerAction(AdaptersConstants.SERVER_ACTION_SHOW_IN_BROWSER);
                        inputShow = await InputBox.create();
                    } catch (error) {
                        if (error.name === 'TimeoutError') {
                            log.warn('InputBox did not appear in given time, retrying to evoke server action');
                            await server.callServerAction(AdaptersConstants.SERVER_ACTION_SHOW_IN_BROWSER);
                            inputShow = await InputBox.create();
                        }
                    }
                    const urls = await Promise.all((await inputShow.getQuickPicks()).map(async item => await item.getText()));
                    await inputShow.cancel();
                    expect(urls).to.include('http://localhost:8080/test-app');
                });

                it(`Verify deployed application`, async function() {
                    this.timeout(30000);
                    const testFile = path.join(__dirname, 'my.out');
                    await downloadFile('http://localhost:8080/test-app', testFile);
                    const content = fs.readFileSync(testFile, 'utf-8');
                    expect(content).to.include('Test Deployment App');
                });

                it(`Remove deployment from the server`, async function() {
                    this.timeout(20000);
                    let server = await serverProvider.getServer(wfServerName);
                    const deployment = await server.getDeployment(appName);
                    expect(deployment).to.be.an.instanceof(Deployment);
                    console.log("remove deployment");
                    await deployment.removeDeployment();
                    // refresh server
                    server = await serverProvider.getServer(wfServerName);
                    expect(await server.getServerPublishState()).to.eq(PublishState.FULL_PUBLISH_REQUIRED);
                    await driver.wait(async () => { return await serverHasDeployment(server, appName) === false; }, 12000);
                });

                afterEach(async function() {
                    this.timeout(8000);
                    try {
                        const input = await InputBox.create();
                        await input.cancel();
                    } catch (error) {
                        // no input box, no need to close it
                        // log.info(`AfterEach: ${error} during opening/closing input box, continue...`);
                    }
                });

                after(async function() {
                    this.timeout(30000);
                    log.debug('Close all editors');
                    await new EditorView().closeAllEditors();
                    log.info('Check existing error notifications');
                    await showErrorNotifications();
                    // clean up notifications
                    log.info('Clear all notifications');
                    await clearNotifications();
                    log.info('Stopping all servers');
                    await stopAllServers(serverProvider);
                    log.info('Deleting all servers');
                    await deleteAllServers(serverProvider);
                });
            });
        }
    });
}
