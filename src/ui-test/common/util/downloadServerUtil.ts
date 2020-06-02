import { RSPServerProvider } from "../../server/ui/rspServerProvider"
import { InputBox, VSBrowser } from "vscode-extension-tester";
import { notificationExists, safeNotificationExists } from "./serverUtils";
import { AdaptersConstants } from "../adaptersContants";


/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export async function downloadServer(rsp: RSPServerProvider, serverName: string) {
        const quick = await rsp.getCreateNewServerBox();
        await quick.selectQuickPick('Yes');
        await VSBrowser.instance.driver.wait( async () => { return await this.downloadableListIsAvailable(quick);}, 5000 );
        await quick.setText(serverName);
        await quick.selectQuickPick(serverName);
        // new editor is opened with license text
        const licenseInput = await InputBox.create();
        // new box should appear with license confirmation, pick -> (Continue...)
        await licenseInput.selectQuickPick('Continue...');
        // confirmation leads to next input: do you agree to license? picks -> Yes (True) or No (False)
        await licenseInput.selectQuickPick('Yes (True)');
        // Clicking yes => Download notification - Job Download runtime: WildFly 19.1.0.Final started.. x
        await VSBrowser.instance.driver.wait( async () => { 
            return await notificationExists(AdaptersConstants.RSP_DOWNLOADING_NOTIFICATION + ' ' + serverName);
        }, 3000 );
        // wait for server to get downloaded
        await VSBrowser.instance.driver.wait( async () => { 
            return !(await safeNotificationExists(AdaptersConstants.RSP_DOWNLOADING_NOTIFICATION + ' ' + serverName));
        }, 180000 );

    }

export async function downloadableListIsAvailable(input: InputBox) {
    const picks = await input.getQuickPicks();
    return picks.length > 0;
}