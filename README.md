# Server Connector

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/redhat.vscode-server-connector?style=for-the-badge&label=VS%20Marketplace&logo=visual-studio-code&color=blue)](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-server-connector)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/redhat.vscode-server-connector?style=for-the-badge&color=purple)](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-server-connector)
[![License](https://img.shields.io/badge/license-EPLv2.0-brightgreen.png?style=for-the-badge)](https://github.com/redhat-developer/vscode-server-connector/blob/master/LICENSE)

A Visual Studio Code extension for interacting with Red Hat JBoss EAP Servers and Runtimes.

### Supported Servers
   * WildFly 33 and below (WildFly 8)
   * Red Hat JBoss Enterprise Application Platform (EAP) 8.0 and below (EAP 4.3)

## Commands and features

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-server-connector/master/screencast/vscode-server-connector.gif)

This extension depends on VSCode RSP UI Extension which is going to be installed automatically along with VSCode Server Connector Extension. RSP UI in conjunction with Server Connector Extension supports several commands for interacting with supported server adapters; these are accessible via the command menu (`Cmd+Shift+P` on macOS or `Ctrl+Shift+P` on Windows and Linux) and may be bound to keys in the normal way.

### Available Commands
   This extension provides no additional commands other than those available in [rsp-ui](https://github.com/redhat-developer/vscode-rsp-ui#available-commands)

## Extension Settings
   This extension provides no additional settings other than those available in [rsp-ui](https://github.com/redhat-developer/vscode-rsp-ui#extension-settings)

## Server Parameters
   This extension provides some ADDITIONAL server parameters in addition to those available in rsp-ui. To see a list of global server parameters, please go [here](https://github.com/redhat-developer/vscode-rsp-ui#server-parameters). Below are JBoss / WildFly specific parameters.

   * `"args.vm.override.string"` - allow to override VM arguments. Once you edit this flag, *make sure "args.override.boolean" is set to true before launching your server. Otherwise, the server will attempt to auto-generate the launch arguments as it normally does.*
   * `"args.program.override.string"` - allow to override program arguments. Once you edit this flag, *make sure "args.override.boolean" is set to true before launching your server. Otherwise, the server will attempt to auto-generate the launch arguments as it normally does.*

   * `"jboss.server.host"` - allow to set the host you want the current JBoss/Wildfly instance to bind to (default localhost)
   * `"jboss.server.port"` - allow to set the port you want the current JBoss/Wildfly instance to bind to (default 8080)
   * `"wildfly.server.config.file"` - the name of the configuration file to be used for the current Jboss/Wildfly instance. The file has to be stored in the same folder as the default standalone.xml file. (e.g "wildfly.server.config.file": "newconfigfile.xml")

## FAQ
---

### 1. How can i override Program and VM arguments?
Due to some issues and requests we received from users we added an additional flag "args.override.boolean" to allow to override program and vm arguments.

When a user attempts to launch his server, we will first check the override boolean value to see if we are overriding. If the user is overriding (right-click your server -> Edit Server -> set "args.override.boolean": "true" ), we will generate the vm args and program args at that time and set them in the server object.

At this point the user will be able to see two other properties in the server editor: "args.vm.override.string" and "args.program.override.string".

Now, if the user wishes to change these flags, he can simply change the override.boolean value to true, and make whatever changes he requires to the program or vm arguments.

If "args.override.boolean" is set to false, the server will attempt to auto-generate the launch arguments as it normally does when launched.

### 2. Can I run my Wildfly Server on a different port than the default one?
Yes. To run a Wildfly Server on a different port you first have to edit the port in the standalone.xml file.

The next step is to add the following setting through the Server Editor in VScode.

Right-click your server -> Edit Server -> add "jboss.server.port": "8888". Change 8888 with the port you choose.

Now if you start the server it should run on the specified port.

### 3. Is there a video that explain how the VSCode Server Connector extension and the Runtime Server Protocol work?
Yes. This is the video you can watch to learn more about this extension https://www.youtube.com/watch?v=sP2Hlw-C_7I

-----------------------------------------------------------------------------------------------------------
## Install extension locally
This is an open source project open to anyone. This project welcomes contributions and suggestions!!

Download the most recent `adapters-<version>.vsix` file and install it by following the instructions [here](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix).

Stable releases are archived under http://download.jboss.org/jbosstools/adapters/snapshots/vscode-middleware-tools

## Community, discussion, contribution, and support

**Issues:** If you have an issue/feature-request with the Server Connector extension, please file it [here](https://github.com/redhat-developer/vscode-server-connector/issues).

**Contributing:** Want to become a contributor and submit your code? Have a look at our [development guide](https://github.com/redhat-developer/vscode-server-connector/blob/master/CONTRIBUTING.md).

**Chat:** Open a [Discussion on GitHub](https://github.com/redhat-developer/vscode-server-connector/discussions)

**UI Testing:**

You can perform UI testing by running the following commands:
1. Download the package and its dependencies
```sh
npm install
```
2. Build the project
```sh
npm run build
```
3. Run UI tests
```sh
npm run public-ui-test
```

License
=======
EPL 2.0, See [LICENSE](LICENSE) for more information.
