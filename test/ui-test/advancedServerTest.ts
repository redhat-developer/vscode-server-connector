// import { expect } from 'chai';
// import * as os from 'os';
// import { RSPServerProvider } from './server/ui/rspServerProvider';
// import { ServerState } from './common/enum/serverState';
// import { deploymentHasState, serverHasDeployment, serverHasPublishState, serverHasState } from './common/util/serverUtils';
// import { EditorView, InputBox, VSBrowser, WebDriver } from 'vscode-extension-tester';
// import { AdaptersConstants } from './common/constants/adaptersContants';
// import { PublishState } from './common/enum/publishState';
// import { downloadFile } from './common/util/downloadServerUtil';
// import { Deployment } from './server/ui/deployment';
// import { Logger } from 'tslog';

// import path = require('path');
// import fs = require('fs');
// import { ServerTestOperator } from './serverTestOperator';
import { ServerTestType } from './common/constants/serverConstants';

// const log: Logger = new Logger({ name: 'advancedE2ETest'});
/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export function deploymentE2ETest(testServers: ServerTestType[]): void {
    // describe('Perform advanced E2E test scenario for server adapters - deployments', () => {

    //     let driver: WebDriver;

    //     before(function() {
    //         if (os.platform() === 'darwin') {
    //             this.skip();
    //         }
    //         driver = VSBrowser.instance.driver;
    //     });

    //     for (const testServer of testServers) {
    //         describe(`Verify ${testServer.serverDownloadName} advanced features - deployments`, () => {

    //             let serverProvider: RSPServerProvider;
    //             const serverOperator = new ServerTestOperator();
    //             const appPath = path.join(__dirname, '../../../test/resources/java-webapp.war');
    //             const appName = 'java-webapp.war';

    //             before(async function() {
    //                 this.timeout(240000);
    //                 await new EditorView().closeAllEditors();
    //                 // start RSP Server provider
    //                 serverProvider = await serverOperator.startRSPServerProvider(driver);
    //                 // create server
    //                 await serverProvider.createServer(testServer);
    //                 const servers = await serverProvider.getServers();
    //                 const serversNames = await Promise.all(servers.map(async item => await item.getServerName()));
    //                 expect(serversNames).to.include.members([testServer.serverName]);
    //                 const server = await serverProvider.getServer(testServer.serverName);
    //                 await server.start();
    //                 await driver.wait(async () => await serverHasState(server, ServerState.Started), 3000);
    //             });

    //             it(`Add new deployment to the ${testServer.serverDownloadName} server`, async function() {
    //                 this.timeout(30000);
    //                 const server = await serverProvider.getServer(testServer.serverName);
    //                 await server.addFileDeployment(appPath);
    //                 await driver.wait(async () => await serverHasDeployment(server, appName), 8000,
    //                     'Deployment was not added to the server');
    //                 const deployment = await server.getDeployment(appName);
    //                 expect(deployment).to.be.an.instanceof(Deployment);
    //                 expect(await deployment.getDeploymentPublishState()).to.be.oneOf([PublishState.PUBLISH_REQUIRED, PublishState.SYNCHRONIZED]);
    //                 await driver.wait(async () =>
    //                     await deploymentHasState(deployment, ServerState.Unknown, ServerState.Started),
    //                 3000,
    //                 'Deployment was not in unknown or started state');
    //                 expect(await server.getServerPublishState()).to.be.oneOf([PublishState.FULL_PUBLISH_REQUIRED, PublishState.SYNCHRONIZED]);
    //             });

    //             it('Perform full publish of the server', async function() {
    //                 this.timeout(15000);
    //                 const server = await serverProvider.getServer(testServer.serverName);
    //                 const deployment = await server.getDeployment(appName);
    //                 expect(deployment).to.be.an.instanceof(Deployment);
    //                 await server.publishFull();
    //                 await driver.wait(async () => await serverHasPublishState(server, PublishState.SYNCHRONIZED), 3000);
    //                 expect(await deployment.getDeploymentState()).to.equal(ServerState.Started);
    //                 expect(await deployment.getDeploymentPublishState()).to.equal(PublishState.SYNCHRONIZED);
    //             });

    //             it('Verify deployment shows up in server actions - Show in browser', async function() {
    //                 this.timeout(20000);
    //                 const server = await serverProvider.getServer(testServer.serverName);
    //                 const actions = await Promise.all((await server.getServerActions()));
    //                 expect(actions).to.include(AdaptersConstants.SERVER_ACTION_SHOW_IN_BROWSER);
    //                 let inputShow;
    //                 try {
    //                     await server.callServerAction(AdaptersConstants.SERVER_ACTION_SHOW_IN_BROWSER);
    //                     inputShow = await InputBox.create();
    //                 } catch (error) {
    //                     if (error.name === 'TimeoutError') {
    //                         log.warn('InputBox did not appear in given time, retrying to evoke server action');
    //                         await server.callServerAction(AdaptersConstants.SERVER_ACTION_SHOW_IN_BROWSER);
    //                         inputShow = await InputBox.create();
    //                     }
    //                 }
    //                 const urls = await Promise.all((await inputShow.getQuickPicks()).map(async item => await item.getText()));
    //                 await inputShow.cancel();
    //                 expect(urls).to.include('http://localhost:8080/java-webapp');
    //             });

    //             it('Verify deployed application', async function() {
    //                 this.timeout(30000);
    //                 const testFile = path.join(__dirname, 'my.out');
    //                 await new Promise((resolve) => setTimeout(resolve, 15000));
    //                 await downloadFile('http://localhost:8080/java-webapp', testFile);
    //                 const content = fs.readFileSync(testFile, 'utf-8');
    //                 expect(content).to.include('Test Deployment App');
    //             });

    //             it('Remove deployment from the server', async function() {
    //                 this.timeout(20000);
    //                 let server = await serverProvider.getServer(testServer.serverName);
    //                 const deployment = await server.getDeployment(appName);
    //                 expect(deployment).to.be.an.instanceof(Deployment);
    //                 await deployment.removeDeployment();
    //                 // refresh server
    //                 server = await serverProvider.getServer(testServer.serverName);
    //                 const serverPubState = await server.getServerPublishState();
    //                 const deployment2 = await server.getDeployment(appName);
    //                 const deploymentPubState = deployment2 ? deployment2.getDeploymentPublishState() : undefined;
    //                 const serverFullPubRequired = serverPubState === PublishState.FULL_PUBLISH_REQUIRED;
    //                 const serverPubSynchronized = serverPubState === PublishState.SYNCHRONIZED;
    //                 const deploymentMissing = deploymentPubState === undefined;
    //                 expect(serverFullPubRequired || (serverPubSynchronized && deploymentMissing)).to.eq(true);
    //                 await driver.wait(async () => { return await serverHasDeployment(server, appName) === false; }, 12000);
    //             });

    //             afterEach(async function() {
    //                 this.timeout(8000);
    //                 try {
    //                     const input = await InputBox.create();
    //                     await input.cancel();
    //                 } catch (error) {
    //                     // no input box, no need to close it
    //                 }
    //             });

    //             after(async function() {
    //                 this.timeout(30000);
    //                 await serverOperator.cleanUpAll();
    //             });
    //         });
    //     }
    // });
}
