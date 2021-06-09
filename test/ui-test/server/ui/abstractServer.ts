import { ViewItem, By, VSBrowser, TreeItem, ModalDialog } from 'vscode-extension-tester';
import { DialogHandler } from 'vscode-extension-tester-native';
import { IServer } from './IServer';
import { ServerState } from '../../common/enum/serverState';
import { serverHasState, serverStateChanged } from '../../common/util/serverUtils';
import { AdaptersConstants } from '../../common/constants/adaptersContants';
import { Logger } from 'tslog';
import { selectContextMenuItemOnTreeItem } from '../../common/util/testUtils';

const log: Logger = new Logger({ name: 'AbstractServer'});

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export abstract class AbstractServer implements IServer {

    private _serverName: string;

    constructor(name: string) {
        this._serverName = name;
    }

    public get serverName(): string {
        return this._serverName;
    }
    public set serverName(value: string) {
        this._serverName = value;
    }

    public async getServerStateLabel(): Promise<string> {
        const text = await this.getTreeItemLabelDescription();
        return text.slice(text.indexOf('(') + 1, text.indexOf(')'));
    }

    public async getTreeItemLabelDescription(): Promise<string> {
        const treeItem = await this.getTreeItem();
        const element = await treeItem.findElement(By.className('label-description'));
        // https://stackoverflow.com/questions/23804123/selenium-gettext
        // const text = await element.getText();
        return await element.getAttribute('innerHTML');
    }

    public async getServerState(): Promise<ServerState> {
        const label = await this.getServerStateLabel();
        return ServerState[label];
    }

    public async getServerName(): Promise<string> {
        const item = (await this.getTreeItem()) as TreeItem;
        if (!item) {
            throw Error('TreeItem of the object in undefined');
        }
        return item.getLabel();
    }

    public async selectContextMenuItem(item: string): Promise<void> {
        const treeItem = await this.getTreeItem();
        await treeItem.select();
        if (!(await treeItem.isSelected())) {
            await treeItem.select();
        }
        try {
            await selectContextMenuItemOnTreeItem(treeItem, item);
        } catch (error) {
            if (error.name === 'StaleElementReferenceError') {
                log.warn(`Retrying abstractSserver.selectContextMenuItem after StaleElemenetReferenceError`);
                await selectContextMenuItemOnTreeItem(treeItem, item);
            } else {
                throw error;
            }
        }
    }

    protected async performServerOperation(contextMenuItem: string, expectedState: ServerState, timeout: number): Promise<void> {
        const oldState = await this.getServerState();
        await this.selectContextMenuItem(contextMenuItem);
        try {
            await VSBrowser.instance.driver.wait(async () => await serverStateChanged(this, oldState), 3000);
        } catch (error) {
            await this.selectContextMenuItem(contextMenuItem);
        }
        await VSBrowser.instance.driver.wait(
            async () => await serverHasState(this, expectedState),
            timeout,
            `Failed to get expected server state ${ServerState[expectedState]} for ${await this.getServerName()} actual state was ${ServerState[await this.getServerState()]}`
        );
    }

    protected async performServerMenuAction<T>(serverAction: string, callback: () => T): Promise<T> {
        try {
            await this.selectContextMenuItem(serverAction);
        } catch (error) {
            log.warn(`Error was caught during server action call ${serverAction}: ${error.message}, retrying...`);
            await this.selectContextMenuItem(serverAction);
        }
        return callback();
    }

    public async start(timeout: number = 10000): Promise<void> {
        await this.performServerOperation(AdaptersConstants.RSP_SERVER_PROVIDER_START, ServerState.Started, timeout);
    }

    public async stop(timeout: number = 10000): Promise<void> {
        await this.performServerOperation(AdaptersConstants.RSP_SERVER_PROVIDER_STOP, ServerState.Stopped, timeout);
    }

    public async terminate(timeout: number = 10000): Promise<void> {
        await this.performServerOperation(AdaptersConstants.RSP_SERVER_PROVIDER_TERMINATE, ServerState.Stopped, timeout);
    }

    public async delete(): Promise<void> {
        try {
            this.selectContextMenuItem(AdaptersConstants.SERVER_REMOVE);
            // try custom native dialog path
            try {
                const dialog = new ModalDialog();
                await dialog.pushButton('Yes');
            } catch (error) {
                log.debug(`Custom dialog was not opened, error: ${error.name}`);
                const dialog = await DialogHandler.getOpenDialog();
                await dialog.confirm(); 
            }
            
        } catch (error) {
            throw Error(`Given server ${this.getServerName()} does not allow to remove the server in actual state, could be starting: ${error}`);
        }
    }

    public abstract getTreeItemImpl(): Promise<ViewItem>;

    public async getTreeItem(): Promise<ViewItem> {
        try {
            return await this.getTreeItemImpl();
        } catch (error) {
            if (error.name === 'StaleElementReferenceError') {
                throw error;
            } else {
                log.warn('Retrying to get tree Item impl. after ' + error.name);
                return await this.getTreeItemImpl();
            }
        }
    }
}
