import { EditorView, Notification, NotificationsCenter, NotificationType, SideBarView, TreeItem, ViewItem, VSBrowser, Workbench } from 'vscode-extension-tester';

import * as os from 'os';
import * as fs from 'fs';
/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export async function findNotification(text: string): Promise<Notification | undefined> {
    await new Workbench().openNotificationsCenter();
    const notifications = await (new NotificationsCenter()).getNotifications(NotificationType.Any);
    for (const notification of notifications) {
        if (notification) {
            const message = await notification.getMessage();
            if (message.indexOf(text) >= 0) {
                return notification;
            }
        }
    }
}

export async function clearNotifications(): Promise<void> {
    const nc = await (new Workbench()).openNotificationsCenter();
    const notifications = await nc.getNotifications(NotificationType.Any);
    if (notifications.length > 0) {
        await nc.clearAllNotifications();
    }
    await nc.close();
}

export async function showErrorNotifications(): Promise<void> {
    const errors = await getNotifications(NotificationType.Error);
    if (errors && errors.length > 0) {
        const report = await Promise.all(errors.map(async error => {
            return `${await error.getType()}: ${await error.getMessage()} \r\n`;
        }));
        console.log(`Error appeared during creating local server adapter: ${report}`);
    }
}

export async function notificationExists(text: string): Promise<boolean> {
    const notifications = await getNotifications();
    for (const notification of notifications) {
        if (notification) {
            const message = await notification.getMessage();
            if (message.indexOf(text) >= 0) {
                return true;
            }
        }
    }
    return false;
}

export async function safeNotificationExists(text: string): Promise<boolean> {
    try {
        return await notificationExists(text);
    } catch (err) {
        if (err.name === 'StaleElementReferenceError') {
            return await notificationExists(text);
        } else {
            throw err;
        }
    }
}

export async function notificationExistsWithObject(text: string): Promise<Notification | undefined> {
    const notifications = await getNotifications();
    for (const notification of notifications) {
        if (notification) {
            const message = await notification.getMessage();
            if (message.indexOf(text) >= 0) {
                return notification;
            }
        }
    }
}

export async function getNotifications(type: NotificationType = NotificationType.Any): Promise<Notification[]> {
    const center = await new Workbench().openNotificationsCenter();
    return await center.getNotifications(type);
}

export async function waitForEvent<T>(func: () => T, timeout: number): Promise<T> {
    return await VSBrowser.instance.driver.wait(func, timeout);
}

export async function asyncFilter<T>(arr: T[], predicate: (item: T) => boolean): Promise<T[]> {
    const results = await Promise.all(arr.map(predicate));
    return arr.filter((_v, index) => results[index]);
}

export async function sectionHasItems(sideBar: SideBarView): Promise<boolean> {
    const sections = await sideBar.getContent().getSections();
    return (await sections[0].getVisibleItems()).length > 0;
}

export async function sectionHasItem(sideBar: SideBarView, name: string): Promise<boolean> {
    const section = await sideBar.getContent().getSection(name);
    return section ? true : false;
}

export async function selectContextMenuItemOnTreeItem(treeItem: TreeItem | ViewItem, itemName: string): Promise<void> {
    let menu = await treeItem.openContextMenu();
    await VSBrowser.instance.driver.wait(async () => {
        if (await menu.hasItem(itemName)) {
            const menuItem = await menu.getItem(itemName);
            return await menuItem.isEnabled() && await menuItem.isDisplayed();
        }
        menu = await treeItem.openContextMenu();
        return false; 
    }, 3000, `Failed waiting for context menu item: ${itemName}`);
    await menu.select(itemName);
}

export async function editorIsOpened(editorName: string): Promise<boolean> {
    const editor = new EditorView();
    const editorTitles = await editor.getOpenEditorTitles();
    return editorTitles.find(item => {
        return item.indexOf(editorName) >= 0;
    }) ? true : false;
}

export async function findDownloadedRuntime(name: string): Promise<string> {
    const homeDir = os.homedir();
    const rspRuntimeInstallations = `${homeDir}/.rsp/redhat-server-connector/runtimes/installations/`;
    let results: string[] = [];
    if(fs.existsSync(rspRuntimeInstallations)) {
        results = await asyncFilter(fs.readdirSync(rspRuntimeInstallations), item => {
            return item.indexOf(name) >= 0;
        });
    }
    if (results.length > 0) {
        const downloadDir = `${rspRuntimeInstallations}/${results[0]}`;
        const finalDir = fs.readdirSync(downloadDir);
        return `${downloadDir}/${finalDir}`;
    } else {
        return undefined;
    }
}