import { TextEditor, VSBrowser, WebDriver } from "vscode-extension-tester";

import { fail } from "assert";
import { notificationExists, clearNotifications } from "./common/util/testUtils";
import { RSPServerProvider } from "./server/ui/rspServerProvider";
import { ServerTestOperator } from "./serverTestOperator";
import { expect } from 'chai';

import * as os from 'os';
import { ServerTestType } from "./common/constants/serverConstants";

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export function advancedServerOperationTest(testServers: ServerTestType[]) {

    describe('Perform basic test scenario for server adapters', () => {

        for (const testServer of testServers) {

            describe(`Verify ${testServer.serverDownloadName} features`, () => {
                let driver: WebDriver;
                let serverOperator = new ServerTestOperator();
                let serverProvider: RSPServerProvider;

                before(async function() {
                    this.timeout(150000);
                    if (os.platform() === 'darwin') {
                        this.skip();
                    }
                    driver = VSBrowser.instance.driver;
                    await serverOperator.openServersSection();
                    serverProvider = await serverOperator.startRSPServerProvider(driver);
                    await serverProvider.createServer(testServer);
                    const servers = await serverProvider.getServers();
                    const serversNames = await Promise.all(servers.map(async item => await item.getServerName()));
                    expect(serversNames).to.include.members([testServer.serverName]);
                });

                describe(`Edit server`, () => {

                    let editor: TextEditor;

                    it('Edit server context menu works and proper editor is opened', async function() {
                        this.timeout(30000);
                        const server = await serverProvider.getServer(testServer.serverName);
                        const textEditor = await server.editServer();
                        expect(textEditor).to.be.instanceOf(TextEditor);
                        expect(await textEditor.getTitle()).to.include(testServer.serverName);
                        try {
                            JSON.parse(await textEditor.getText())
                        } catch (error) {
                            fail(`Edit server json is not valid ${error}`);
                        }
                        editor = textEditor as TextEditor;
                    });

                    it('Server editor allowed changes can be saved', async function() {
                        this.timeout(30000);
                        let index = await editor.getLineOfText("args.override.boolean");
                        let line = await editor.getTextAtLine(index);
                        expect(line).to.include("\"args.override.boolean\": \"false\"");
                        await editor.setTextAtLine(index, line.replace("false", "true"));
                        if (await editor.isDirty()) {
                            await editor.save();
                        }
                        await driver.wait(async () => await notificationExists("correctly saved"), 3000);
                        expect(await editor.getTextAtLine(index)).to.include("\"args.override.boolean\": \"true\"");
                    });

                    it('Server editor forbidden changes cannot be saved', async function() {
                        this.timeout(30000);
                        let index = await editor.getLineOfText("id-set");
                        let line = await editor.getTextAtLine(index);
                        expect(line).to.include("\"id-set\": \"true\"");
                        await editor.setTextAtLine(index, line.replace("true", "false"));
                        if (await editor.isDirty()) {
                            await editor.save();
                            await driver.wait(async () => (await editor.getTextAtLine(index)).indexOf("true"), 3000);
                        }
                        await driver.wait(async () => await notificationExists("may not be changed"), 3000);
                        expect(await editor.getTextAtLine(index)).to.include("\"id-set\": \"true\"");
                    });
                
                    afterEach(async function() {
                        this.timeout(5000);
                        await clearNotifications();
                    })

                });

                after(async function() {
                    this.timeout(30000);
                    await serverOperator.cleanUpAll();
                });

            });
        }

    });
}

