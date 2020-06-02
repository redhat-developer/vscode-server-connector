import { ServerState } from '../enum/serverState';
import { Notification, VSBrowser, NotificationsCenter, NotificationType, Workbench, SideBarView } from "vscode-extension-tester";
import { IServer } from '../../server/ui/IServer';
import { RSPServerProvider } from '../../server/ui/rspServerProvider';

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export async function serverHasState(server: IServer, state: ServerState): Promise<boolean> {
    var stateActual = await server.getServerState();
    return stateActual === state;
}

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

export async function deleteAllServers(rsp: RSPServerProvider): Promise<void> {
    const servers = await rsp.getServers();
    for (let server of servers) {
        await server.delete();
    }
}

export async function stopAllServers(rsp: RSPServerProvider): Promise<void> {
    const servers = await rsp.getServers();
    for (let server of servers) {
        await server.stop();
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
    await new Workbench().openNotificationsCenter();
    return await (new NotificationsCenter()).getNotifications(type);
}

export async function waitForEvent(func: Function, timeout: number): Promise<any | undefined> {
    return await VSBrowser.instance.driver.wait(func, timeout);
}

export const asyncFilter = async (arr, predicate) => {
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