import { keyboard, Key } from '@nut-tree/nut-js';

/**
 * Editor close operation dialog handler
 * @author Ondrej Dockal <odockal@redhat.com>
 */

export class CloseEditorNativeDialog {
    async tapKey(key: Key) {
        await keyboard.pressKey(key);
        await keyboard.releaseKey(key);
    }

    async closeWithoutSaving() {
        await this.tapKey(Key.Left);
        await this.tapKey(Key.Left);
        await this.tapKey(Key.Left);
        await this.tapKey(Key.Enter);
    }
}