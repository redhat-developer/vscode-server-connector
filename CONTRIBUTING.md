# Contributing

## Using local rsp-client 

When adding new features into the code base, you may need to modify the ```rsp-client``` code base as well.
As ```rsp-client``` is an npm dependency, by default, it will fetch the code from the global npm registry.

In order to get faster feedback, here is the procedure to work locally on the two different codebases in parallel.

- clone the two repos on your local workstation
- in the ```vscode-server-connector``` folder, run the following command: ```npm link ../rsp-client``` (assumed the two folders are at the same level in the folder hierarchy)
- the ```vscode-server-connector``` codebase will now use the local codebase of ```rsp-client``` instead of the one from the global npm registry.
- if you make modifications to the ```rsp-client``` codebase, you must run the following command (from the local ```rsp-client``` folder): ```npm run build``` so that the Javascript files are regenerated.
### Certificate of Origin

By contributing to this project you agree to the Developer Certificate of
Origin (DCO). This document was created by the Linux Kernel community and is a
simple statement that you, as a contributor, have the legal right to make the
contribution. See the [DCO](DCO) file for details.
