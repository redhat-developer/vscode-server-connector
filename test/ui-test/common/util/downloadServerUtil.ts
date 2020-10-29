import { InputBox } from 'vscode-extension-tester';

import * as fs from 'fs-extra';
import request = require('request');
import { Unpack } from './unpack';

/**
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export async function downloadableListIsAvailable(input: InputBox) {
    const picks = await input.getQuickPicks();
    return picks.length > 0;
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
