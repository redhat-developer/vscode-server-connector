/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Uri } from 'vscode';
import { Protocol } from 'rsp-client';
import * as path from 'path';

export class ServerIcon {

  public static get(serverType: Protocol.ServerType): Uri {
      if (!serverType
          || !serverType.id) {
              return null;
      }

      return Uri.file(path.join(__dirname, '..', '..', 'images', this.getFilename(serverType)));
  }

  private static getFilename(serverType: Protocol.ServerType): string {
      if (!serverType) {
          return null;
      } else if (serverType.id.startsWith('org.jboss.ide.eclipse.as.7')) {
          return 'jbossas7_ligature.svg';
      } else if (serverType.id.startsWith('org.jboss.ide.eclipse.as.wildfly.')) {
          return 'wildfly_icon.svg';
      } else if (serverType.id.startsWith('org.jboss.ide.eclipse.as.eap.')) {
          return 'producticons_1017_RGB_EAP_color.png';
      } else if (serverType.id.startsWith('org.jboss.tools.openshift.cdk.server.type')) {
          return 'Logotype_RH_OpenShift.svg';
      } else {
          return 'server-light.png';
      }
  }
}
