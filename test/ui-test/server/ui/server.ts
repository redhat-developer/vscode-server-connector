import { RSPServerProvider } from "./rspServerProvider";
import { ViewItem, TreeItem, InputBox } from "vscode-extension-tester";
import { AbstractServer } from "./abstractServer";
import { AdaptersConstants } from "../../common/constants/adaptersContants";
import { ServerState } from "../../common/enum/serverState";
import { DialogHandler } from "vscode-extension-tester-native";
import { PublishState } from "../../common/enum/publishState";
import { Deployment } from "./deployment";
import { Logger } from "tslog";


const log: Logger = new Logger({ name: 'AbstractServer'});
/**
 * Application Server item representation
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export class Server extends AbstractServer {

    private _serverParent: RSPServerProvider;

    constructor(name: string, parent: RSPServerProvider) {
        super(name);
        this._serverParent = parent;
    }

    public get serverParent(): RSPServerProvider {
        return this._serverParent;
    }
    public set serverParent(value: RSPServerProvider) {
        this._serverParent = value;
    }

    public async getTreeItemImpl(): Promise<ViewItem> {
        const parent = await this.serverParent.getTreeItem();
        const treeItem = await (parent as TreeItem).findChildItem(this.serverName);
        return treeItem;
    }

    public async start(timeout: number = 20000): Promise<void> {
        await this.performServerOperation(AdaptersConstants.SERVER_START, ServerState.Started, timeout);
    }

    public async stop(timeout: number = 20000): Promise<void> {
        await this.performServerOperation(AdaptersConstants.SERVER_STOP, ServerState.Stopped, timeout);
    }

    public async terminate(timeout: number = 10000): Promise<void> {
        await this.performServerOperation(AdaptersConstants.SERVER_TERMINATE, ServerState.Stopped, timeout);
    }

    public async restart(timeout: number = 30000): Promise<void> {
        await super.performServerOperation(AdaptersConstants.SERVER_RESTART_RUN, ServerState.Started, timeout);
    }

    public async getServerPublishStateLabel(): Promise<string> {
        const description = await this.getTreeItemLabelDescription();
        const firstEndBrace = description.indexOf(')');
        const startSearchForSecond = description.indexOf('(', firstEndBrace + 1);
        return description.slice(startSearchForSecond + 1, description.length - 1);
    }

    public async getServerPublishState(): Promise<PublishState> {
        const stateLabel = await this.getServerPublishStateLabel();
        const result = Object.keys(PublishState).filter(key => stateLabel === PublishState[key]);
        return PublishState[result[0]];
    }

    public async addFileDeployment(deploymentPath: string, customName?: string): Promise<void> {
        // call add deployment contenxt menu over server item
        await this.selectContextMenuItem(AdaptersConstants.SERVER_ADD_DEPLOYMENT);
        // input dialog for file or exploded deployment
        const deploymentInput = await InputBox.create();
        // pass a path to the deployment
        await deploymentInput.selectQuickPick(AdaptersConstants.SERVER_DEPLOYMENT_FILE);
        // it might happen, depending on vscode settings, that native file manager dialog wont appear
        // instead we got input box where we can search for files
        try {
            const inputFile = await InputBox.create();
            const actualText = await inputFile.getText();
            if (actualText.length > 0) {
                console.log("Text after opening input box: " + actualText);
            }
            // await inputFile.clear();
            await inputFile.setText(deploymentPath);
            console.log("Text after setting text: " + await inputFile.getText());
            await inputFile.confirm();
        } catch (error) {
            log.warn(`InputBox bar did not appear, ${error}, \r\ntrying native file manager...`);
            const browseDialog = await DialogHandler.getOpenDialog();
            await browseDialog.selectPath(deploymentPath);
            await browseDialog.confirm();
        }
        // Edit optional parameters
        const optionsInput = await InputBox.create();
        if (customName) {
            await optionsInput.selectQuickPick(AdaptersConstants.YES);
            const nameInput = await InputBox.create();
            await nameInput.setText(customName);
            await nameInput.confirm();
        } else {
            await optionsInput.selectQuickPick(AdaptersConstants.NO);
        }
    }

    public async addExplodedDeployment(deploymentPath: string, customName: string): Promise<void> {
        // call add deployment contenxt menu over server item
        await this.selectContextMenuItem(AdaptersConstants.SERVER_ADD_DEPLOYMENT);
        // input dialog for file or exploded deployment
        const deploymentInput = await InputBox.create();
        // pass a path to the deployment
        await deploymentInput.selectQuickPick(AdaptersConstants.SERVER_DEPLOYMENT_EXPLODED);
        const browseDialog = await DialogHandler.getOpenDialog();
        await browseDialog.selectPath(deploymentPath);
        await browseDialog.confirm();
        // Edit optional parameters
        const optionsInput = await InputBox.create();
        await optionsInput.selectQuickPick(AdaptersConstants.YES);
        const nameInput = await InputBox.create();
        await nameInput.setText(customName);
        await nameInput.confirm();
    }

    public async publishFull(): Promise<void> {
        await this.selectContextMenuItem(AdaptersConstants.SERVER_PUBLISH_FULL);
    }

    public async publishIncremental(): Promise<void> {
        await this.selectContextMenuItem(AdaptersConstants.SERVER_PUBLISH_INCREMENTAL);
    }

    public async serverActions(): Promise<InputBox> {
        try {
            await this.selectContextMenuItem(AdaptersConstants.SERVER_ACTIONS);
        } catch (error) {
            log.warn(`Error was caught during server action call: ${error.message}, retrying...`);
            await this.selectContextMenuItem(AdaptersConstants.SERVER_ACTIONS);
        }
        return await InputBox.create();
    }

    public async getServerActions(): Promise<string[]> {
        const items = [];
        const input = await this.serverActions();
        (await input.getQuickPicks()).map(async item => items.push(await item.getText()));
        await input.cancel();
        return await Promise.all(items);
    }

    public async callServerAction(action: string): Promise<void> {
        const input = await this.serverActions();
        await input.selectQuickPick(action);
    }

    public async getDeployments(): Promise<Deployment[]> {
        const deployments = [];
        const treeItem = await this.getTreeItem();
        const treeItems = await (treeItem as TreeItem).getChildren();
        for (const item of treeItems) {
            let text = await item.getText();
            if (text.indexOf('(') > 0) {
                text = text.slice(0, text.indexOf('('));
            }
            deployments.push(new Deployment(text, this));
        }
        return deployments;
    }

    public async getDeployment(deplName: string, contains: boolean = true): Promise<Deployment | undefined> {
        const treeItem = await this.getTreeItem();
        let treeItems = [];
        try {
            treeItems = await (treeItem as TreeItem).getChildren();
        } catch (error) {
            if (error.name === 'StaleElementReferenceError') {
                log.warn(`${error.message} during getting treeItem getChildren`);
                return undefined;
            }
            throw error;
        }
        for (const item of treeItems) {
            let text;
            try {
                text = await item.getText();
            } catch (error) {
                if (error.name === 'StaleElementReferenceError') {
                    log.warn(`${error.message} during getting deployment`);
                }
                throw error;
            }
            if (text.indexOf('(') > 0) {
                text = text.slice(0, text.indexOf('('));
            }
            if ((!contains && text === deplName) || (contains && text.indexOf(deplName) >= 0)) {
                return new Deployment(text, this);
            }
        }
    }
}
