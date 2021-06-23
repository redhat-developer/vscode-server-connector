import { EditorView, TextEditor, VSBrowser, WebDriver } from "vscode-extension-tester";

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
                    });

                });

                describe(`Server actions`, () => {

                    it('Offers Edit configuration file option', async function() {
                        this.timeout(30000);
                        const server = await serverProvider.getServer(testServer.serverName);
                        const actions = await server.getServerActions();
                        expect(actions.length).to.equal(1);
                        expect(actions).to.include.members(['Edit Configuration File...']);
                    });

                    it('Edit configuration file action opens up editor', async function() {
                        this.timeout(30000);
                        const server = await serverProvider.getServer(testServer.serverName);
                        await server.callServerAction('Edit Configuration File...');
                        const editorView = new EditorView();
                        const editor = await VSBrowser.instance.driver.wait(async (item) => {
                            const editors = await editorView.getOpenEditorTitles();
                            const matches = editors.filter(editor => {
                                return editor.match(new RegExp(`standalone*.xml`));
                            });
                            return editorView.openEditor(matches[0]);
                        });
                        expect(await editor.getText()).to.include('jboss.https.port');
                    });

                    it('Show In Browser option is present after server is started up', async function() {
                        this.timeout(30000);
                        const server = await serverProvider.getServer(testServer.serverName);
                        await server.start();
                        const actions = await server.getServerActions();
                        expect(actions.length).to.equal(2);
                        expect(actions).to.include.members(['Edit Configuration File...', 'Show in browser...']);
                    });
                
                    afterEach(async function() {
                        this.timeout(5000);
                        try {
                            await new EditorView().closeAllEditors();
                        } catch (error) {
                            // no input box, not need to close it
                            console.log(error);
                        }
                        await clearNotifications();
                    });
                });

                after(async function() {
                    this.timeout(30000);
                    await serverOperator.cleanUpAll();
                });

            });
        }

    });
}

