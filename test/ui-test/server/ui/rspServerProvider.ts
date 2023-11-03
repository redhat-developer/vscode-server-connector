import { InputBox, ModalDialog, ViewItem, Workbench, TreeItem, VSBrowser, EditorView } from 'vscode-extension-tester';
import { AdaptersConstants } from '../../common/constants/adaptersContants';
import { Server } from './server';
import { AbstractServer } from './abstractServer';
import { IServersProvider } from './IServersProvider';
import { editorIsOpened, findDownloadedRuntime, notificationExists, safeNotificationExists } from '../../common/util/testUtils';
import { downloadableListIsAvailable } from '../../common/util/downloadServerUtil';
import { Logger } from 'tslog';
import { ServerCreationForm } from './serverCreationForm';
import { ServerTestType } from '../../common/constants/serverConstants';

const log: Logger = new Logger({ name: 'rspServerProvider'});

/**
 * RSP Server Provider item representation
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export class RSPServerProvider extends AbstractServer {

    private _serversProvider: IServersProvider;

    constructor(sbar: IServersProvider, name: string) {
        super(name);
        this._serversProvider = sbar;
    }

    public get serversProvider(): IServersProvider {
        return this._serversProvider;
    }

    public async getTreeItemImpl(): Promise<ViewItem> {
        const section = await this.serversProvider.getServerProviderTreeSection();
        await VSBrowser.instance.driver.wait(async () => {
            try {
                return (await section.getVisibleItems()).length > 0;
            }  catch (error) {
                if (error.name === 'StaleElementReferenceError') {
                    log.warn('Retrying section.getVisibleItems after StaleElemenetReferenceError');
                    return (await section.getVisibleItems()).length > 0;
                } else {
                    throw error;
                }
            }
        }, 3000);
        let rspServerItem: ViewItem;
        try {
            rspServerItem = await section.findItem(this.serverName);
        } catch (error) {
            if (error.name === 'StaleElementReferenceError') {
                log.warn('Retrying section.findItem after StaleElemenetReferenceError');
                rspServerItem = await section.findItem(this.serverName);
            } else {
                throw error;
            }
        }
        if (!rspServerItem) {
            const availableItems = await Promise.all((await section.getVisibleItems()).map(async item => await item.getText()));
            throw Error(`No item found for name ${this.serverName} available items: ${availableItems}`);
        }
        return rspServerItem;
    }

    public async getServers(): Promise<Server[]> {
        const servers = [];
        const items = await (await this.getTreeItem() as TreeItem).getChildren();
        for (const item of items) {
            const label = await item.getLabel();
            servers.push(new Server(label, this));
        }
        return servers;
    }

    public async getServer(name: string): Promise<Server> {
        const items = await (await this.getTreeItem() as TreeItem).getChildren();
        for (const item of items) {
            const label = await item.getLabel();
            if (label === name) {
                return new Server(label, this);
            }
        }
        throw Error(`Server ${name} does not exist`);
    }

    public async getCreateNewServerBox(): Promise<InputBox> {
        await this.selectContextMenuItem(AdaptersConstants.RSP_SERVER_PROVIDER_CREATE_NEW_SERVER);
        return await InputBox.create();
    }

    public async createNewServerCommand(): Promise<void> {
        await new Workbench().executeCommand(`${AdaptersConstants.RSP_COMMAND} ${AdaptersConstants.RSP_SERVER_PROVIDER_CREATE_NEW_SERVER}`);
    }

    public delete(): Promise<void> {
        throw Error('RSP Server does not support delete operation');
    }

    public async createDownloadServer(serverName: string, closeLicenseEditor = true): Promise<void> {
        const quick = await this.getCreateNewServerBox();
        await quick.selectQuickPick('Yes');
        await VSBrowser.instance.driver.wait(async () => await downloadableListIsAvailable(quick), 5000);
        await quick.setText(serverName);
        await quick.selectQuickPick(serverName);
        // new editor is opened with license text
        const licenseInput = await InputBox.create();
        // new box should appear with license confirmation, pick -> (Continue...)
        await licenseInput.selectQuickPick('Continue...');
        // confirmation leads to next input: do you agree to license? picks -> Yes (True) or No (False)
        await licenseInput.selectQuickPick('Yes (True)');
        // Clicking yes => Download notification - Job Download runtime: WildFly 19.1.0.Final started.. x
        await VSBrowser.instance.driver.wait(async () => {
            return await notificationExists(`${AdaptersConstants.RSP_DOWNLOADING_NOTIFICATION} ${serverName}`);
        }, 3000);
        // wait for server to get downloaded
        await VSBrowser.instance.driver.wait(async () => {
            return !(await safeNotificationExists(`${AdaptersConstants.RSP_DOWNLOADING_NOTIFICATION} ${serverName}`));
        }, 180000);
        // close opened license file in editor
        if (closeLicenseEditor) {
            const editorView = new EditorView();
            const editor = await editorView.openEditor(AdaptersConstants.LICENSE_EDITOR);
            if (editor && await editor.isDisplayed()) {
                await editorView.closeEditor(AdaptersConstants.LICENSE_EDITOR);
                try {
                    const dialog = new ModalDialog();
                    await dialog.pushButton('Don\'t Save');
                } catch (error) {
                    log.debug(`Error encountered opening modal dialog: ${error}:${error.message}`);
                    throw error;
                }
            }
        }
    }

    public async createLocalServer(serverPath: string, serverName: string, webView = false): Promise<void> {
        log.info(`Creating new local server at ${serverPath}`);
        const quick = await this.getCreateNewServerBox();
        await quick.selectQuickPick('No, use server on disk');
        log.info(`Selected use server on disk`);

        log.info(`Awaiting possible file manager input box`);

        // it might happen, depending on vscode settings, that native file manager dialog wont appear
        // instead we got input box where we can search for files
        try {
            const inputFile = await InputBox.create();
            await inputFile.setText(serverPath);
            await inputFile.confirm();
        } catch (error) {
            log.warn(`InputBox bar did not appear, ${error.name}`);
            throw error;
        }

        // might get secure storage input box
        log.info(`Awaiting possible secure storage prompt`);
        try {
            const secureStorage = await InputBox.create();
            const indexOf = (await secureStorage.getMessage()).indexOf('secure storage');
            if (indexOf >= 0) {
                await secureStorage.confirm();
            }
        } catch (error) {
            // no input box, we can continue
        }
        // Since rsp-ui 0.23.9 there is by default new webView now
        // can be turned off by setting property: rsp-ui.newserverwebviewworkflow = false
        if (webView) {
            log.info(`Filling out new server details via webview`);
            await VSBrowser.instance.driver.wait(async () => editorIsOpened('New Server'), 3000);
            const editorView = new EditorView();
            const editors = await editorView.getOpenEditorTitles();
            const newServerEditorName = editors.find(item => {
                return item.indexOf('New Server') >= 0;
            });
            const serverView = new ServerCreationForm(newServerEditorName);
            await serverView.initializeEditor();
            await serverView.setServerId(serverName);
            await serverView.finish();
        } else {
            log.info(`Filling out new server details via input box`);
            const nameInput = await InputBox.create();
            await nameInput.setText(serverName);
            await nameInput.confirm();
            const optionsInput = await InputBox.create();
            await optionsInput.selectQuickPick('No');
        }
        log.info(`Done creating new server from local disk`);
    }

    public async createServer(testServer: ServerTestType): Promise<void> {
        let serverPath: string;
        const downloadedServerPath = await findDownloadedRuntime(testServer.serverInstallationName);
        if (downloadedServerPath) {
            log.info(`Found already downloaded server: ${testServer.serverName}`);
            serverPath = downloadedServerPath;
        }
        if (!serverPath) {
            await this.createDownloadServer(testServer.serverDownloadName);
        } else {
            await this.createLocalServer(serverPath, testServer.serverName, true);
        }
    }
}
