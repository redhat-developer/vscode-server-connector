import { AdaptersConstants } from '../adaptersContants';
import { RSPServerProvider } from '../../server/ui/rspServerProvider';
import { notificationExists, safeNotificationExists } from './serverUtils';
import { InputBox, VSBrowser } from 'vscode-extension-tester';

import * as fs from 'fs-extra';
import request = require('request');
import { Unpack } from './unpack';
import { DialogHandler } from 'vscode-extension-tester-native';

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export async function createDownloadServer(rsp: RSPServerProvider, serverName: string) {
    const quick = await rsp.getCreateNewServerBox();
    await quick.selectQuickPick('Yes');
    await VSBrowser.instance.driver.wait( async () => await this.downloadableListIsAvailable(quick), 5000 );
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
        return await notificationExists(`${AdaptersConstants.RSP_DOWNLOADING_NOTIFICATION} ${serverName}`);
    }, 3000 );
    // wait for server to get downloaded
    await VSBrowser.instance.driver.wait( async () => {
        return !(await safeNotificationExists(`${AdaptersConstants.RSP_DOWNLOADING_NOTIFICATION} ${serverName}`));
    }, 180000 );
}

export async function downloadableListIsAvailable(input: InputBox) {
    const picks = await input.getQuickPicks();
    return picks.length > 0;
}

export async function createLocalServer(rsp: RSPServerProvider, serverPath: string, serverName: string) {
    const quick = await rsp.getCreateNewServerBox();
    await quick.selectQuickPick('No, use server on disk');
    // native dialog
    const browseDialog = await DialogHandler.getOpenDialog();
    await browseDialog.selectPath(serverPath);
    await browseDialog.confirm();

    // provide the server name
    if (quick && quick.isDisplayed() && !quick.hasError()) {
        await quick.setText(serverName);
        await quick.confirm();
    } else {
        const nameInput = await InputBox.create();
        await nameInput.setText(serverName);
        await nameInput.confirm();
    }
    // do you wanna edit server parameters? No...
    const optionsInput = await InputBox.create();
    await optionsInput.selectQuickPick('No');
}

export async function downloadFile(url: string, target: string): Promise<void> {
    return await new Promise<void>(resolve => {
        request.get(url)
            .pipe(fs.createWriteStream(target))
            .on('close', resolve);
    });
}

export async function downloadExtractFile(url: string, target: fs.PathLike, extractTarget: fs.PathLike): Promise<void> {
    await downloadFile(url, target);
    return await Unpack.unpack(target, extractTarget);
}
