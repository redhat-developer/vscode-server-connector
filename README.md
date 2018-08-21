# Visual Studio Code Adapters Tools

[![Build Status](https://travis-ci.org/redhat-developer/vscode-adapters.svg?branch=master)](https://travis-ci.org/redhat-developer/vscode-adapters)

A Visual Studio Code extension for interacting with different server adapters and runtimes.

## Features

This extension supports a number of commands for interacting with server adapters; these are accessible via the command menu (`Cmd+Shift+P` on macOS or `Ctrl+Shift+P` on Windows and Linux) and may be bound to keys in the normal way.

### General Commands

   * `Add Server Location` - Selects the path of the server location and display in the SERVERS Explorer stack.
   * `Start` - From the list of servers present, select the server to start.
   * `Stop` - From the list of servers present, select the server to stop.
   * `Remove` - From the list of servers present, select the server to be removed.
   * `Debug` - From the list of servers present, select the server to run in Debug mode.
   * `Show Output Channel` - Select a particular server from the list to show its ouput channel in the editor.

### Supported Servers
   * Wildfly [8/9/10/11/12/13]
   * EAP
   * Minishift Binary

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `vscodeAdapters.showChannelOnServerOutput`: enable/disable the server output channel logs

-----------------------------------------------------------------------------------------------------------
Contributing
===============
This is an open source project open to anyone. This project welcomes contributions and suggestions!!

Download the most recent `adapters-<version>.vsix` file and install it by following the instructions [here](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix). 

Stable releases are archived under http://download.jboss.org/jbosstools/adapters/snapshots/

Feedback
===============
* File a bug in [GitHub Issues](https://github.com/redhat-developer/vscode-adapters/issues)
* Chat with us on [Mattermost](https://chat.openshift.io/developers/channels/adapters)

License
===============
EPL 2.0, See [LICENSE](LICENSE) for more information.
