import { RSPServerProvider } from "./ui/rspServerProvider";
import { ServerState } from './../common/serverState';
import { Notification, Workbench, VSBrowser } from "vscode-extension-tester";


export async function serverHasState(server: RSPServerProvider, state: ServerState): Promise<boolean> {
    var stateActual = await server.getServerState();
    return stateActual === state;
}

export async function notificationExists(text: string): Promise<Notification | undefined> {
    const notifications = await new Workbench().getNotifications();
    for (const notification of notifications) {
        const message = await notification.getMessage();
        if (message.indexOf(text) >= 0) {
            return notification;
        }
    }
}

export async function waitForEvent(func: Function, timeout: number): Promise<any | undefined> {
    return await VSBrowser.instance.driver.wait(func, timeout);
}

export const asyncFilter = async (arr, predicate) => {
	const results = await Promise.all(arr.map(predicate));

	return arr.filter((_v, index) => results[index]);
}