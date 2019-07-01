# Change Log

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
- Configuration option added to choose which JDK to use when starting the RSP server itself. See https://github.com/redhat-developer/vscode-adapters/pull/229 to learn more.

## 0.0.1
- Support for different Wildfly versions
- Supoort for minishift


