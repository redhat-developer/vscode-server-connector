
import { OutputChannel } from 'vscode';

export class XLog {
    private static _outputPanel;

    public static registerOutputPanel(outputPanel: OutputChannel) {
        this._outputPanel = outputPanel;
    }

    public static debug(log: String) {
        this.typeLog(log, 'DEBUG');
    }

    public static error(log: String) {
        this.typeLog(log, 'ERROR');
    }

    public static info(log: String) {
        this.typeLog(log, 'INFO');
    }

    public static success(log: String) {
        this.typeLog(log, 'SUCCESS');
    }

    private static typeLog(log: String, type: String) {
        if (!this._outputPanel) {
            return;
        }
        this._outputPanel.show();
        const util = require('util');
        const time = TimeUtils.getTime();
        if (!log || !log.split) return;
        this._outputPanel.appendLine(util.format('[ssp-server %s][%s]\t %s', time, type, log));
    }
}

export class TimeUtils {
    public static getTime(): String {
        return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '').split(' ')[1];
    }
}
