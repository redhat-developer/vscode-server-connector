# Change Log

## 0.25.2
Upversion to use latest rsp-server
## 0.23.14
Upversion to use latest rsp-server
## 0.23.11
Upversion to use latest rsp-server
## 0.23.10
Upversion to use latest rsp-server
## 0.23.6
Upversion to use latest rsp-server
## 0.23.5
Upversion to use latest rsp-server
## 0.23.3
Upversion to use latest rsp-server
## 0.23.2
Upversion to use latest rsp-server
## 0.23.1
Upversion to use latest rsp-server
## 0.22.11
Upversion to use latest rsp-server
## 0.22.8
Upversion to use latest rsp-server
## 0.22.7
Upversion to use latest rsp-server
## 0.22.6
Upversion to use latest rsp-server
## 0.22.5
Upversion to use latest rsp-server
## 0.22.2
Upversion to use latest rsp-server
## 0.21.2
Upversion to use latest rsp-server
## 0.21.1
Upversion to use latest rsp-server
## 0.21.0
Upversion to use latest rsp-server
## 0.20.2
Upversion to use latest rsp-server
## 0.20.1
Upversion to use latest rsp-server

## 0.20.0
- Broke up UI into an RSP provider and a main UI for others to contribute to
- Consume rsp-client 0.20.0
- Support changing program and vm arguments for WildFly launches

## 0.15.3
- Bundles updated rsp-server 0.15.3.Final
- Support for WildFly 16
- Supports incremental publishes
- Supports exploded deployment
- Supports changing output archive / folder's name if different than workspace folder / file name
- Supports various CDK versions along with the minishift support, though this may be broken out into a standalone release in the future
- Now supports running a java-based server in debug mode and connecting a remote debugger to it
- Fixed filechooser bug where Windows cannot support a dialog capable of choosing a file or folder at the same time
- Small hardening against bugs or invalid data

## 0.13.0
- Bundles updated rsp-server 0.13.0.Final
- Support for WildFly 15
- Ability to add or remove a deployment to the server
- Ability to perform full publishes on the server
- Run / Publish state for Server in Servers view now accurate
- Automatically update publish state for a deployment if deployment source in vscode has changed
- Clean up context menu to only show relevant actions [issue 203 / 204 / 206]
- Red Hat Container Development Kit (CDK), found at https://developers.redhat.com/products/cdk, is not currently supported, but is planned. Attempts to create a CDK server adapter will fail. 
- Configuration option added to choose which JDK to use when starting the RSP server itself. See https://github.com/redhat-developer/vscode-server-connector/pull/229 to learn more.

## 0.0.1
- Support for different Wildfly versions
- Supoort for minishift


