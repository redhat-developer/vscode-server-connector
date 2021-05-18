import { WebViewForm } from "../../common/ui/webViewForm";

/**
 * Web View form for defining local server during its creation
 * @author Ondrej Dockal <odockal@redhat.com>
 */
export class ServerCreationForm extends WebViewForm {

    readonly serverId = 'id';
    readonly serverHomeDirId = 'server.home.dir';
    readonly vmInstallPathId = 'vm.install.path';
    readonly AutopublishEnabledId = 'server.autopublish.enabled';
    readonly autopublishInactivityLimitId = 'server.autopublish.inactivity.limit';
    readonly serverHostId = 'jboss.server.host';
    readonly serverPortId = 'jboss.server.port';
    readonly servefConfigFileId = 'wildfly.server.config.file';
    readonly serverDeployDirId = 'wildfly.server.deploy.directory';

    public async setServerId(value: string) {
        await this.setElementValueById(this.serverId, value);
    }

    public async getServerIdValue(): Promise<string> {
        return await this.getElementValueById(this.serverId);
    }
    public async setServerHomeDirId(value: string) {
        await this.setElementValueById(this.serverHomeDirId, value);
    }

    public async getServerHomeDirIdValue(): Promise<string> {
        return await this.getElementValueById(this.serverHomeDirId);
    }
}
