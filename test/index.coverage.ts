/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

declare var global: any;

import * as glob from 'glob';
import * as paths from 'path';
import * as Mocha from 'mocha';

// Linux: prevent a weird NPE when mocha on Linux requires the window size from the TTY
// Since we are not running in a tty environment, we just implementt he method statically
const tty = require('tty');
if (!tty.getWindowSize) {
    tty.getWindowSize = (): number[] => {
        return [80, 75];
    };
}

const config : Mocha.MochaOptions = {
    reporter: 'spec',
    ui: 'tdd',
    color: true,
    timeout: 15000,
    reporterOptions: {}
};

if (process.env.BUILD_ID && process.env.BUILD_NUMBER) {
    const testReportPath = 'test-resources/test-report.xml'
    console.log(`Creating test report at ${testReportPath}`);
    config.reporter = 'mocha-jenkins-reporter';
    config.reporterOptions = {
        "junit_report_name": "Tests",
        "junit_report_path": testReportPath,
        "junit_report_stack": 1
    }
}

let mocha = new Mocha(config);

// The test coverage approach is inspired by https://github.com/microsoft/vscode-js-debug/blob/master/src/test/testRunner.ts
async function setupCoverage() {
    const NYC = require("nyc");
    const nyc = new NYC(
        {// set the project root
        cwd: paths.join(__dirname, "..", ".."),
        include: ["src/**/*.ts", "out/**/*.js"],
        exclude: ["**/*test/**", ".vscode-test/**"],
        reporter: ["text", "text-lcov", "lcov", "json"],
        tempDir: paths.join(__dirname, "..", "..", ".nyc_output"),
        all: true,
        checkCoverage: true,
        instrument: true,
        hookRequire: true,
        hookRunInContext: true,
        hookRunInThisContext: true,
    });

    await nyc.reset();
    await nyc.wrap();

    return nyc;
}

export async function run(): Promise<void> {

    let nyc = await setupCoverage();
    // only search test files under out/test
    const testsRoot = paths.resolve(__dirname);
    const options = { cwd: testsRoot };
    const files = glob.sync("**/**.test.js", options);
    for (const file of files) {
        mocha.addFile(paths.resolve(testsRoot, file));
    }
    try {
        await new Promise<void>((resolve, reject) =>
            mocha.run(failures => (failures ? reject(new Error(`${failures} tests failed`)) : resolve()))
        );
    } finally {
        if (nyc !== undefined) {
            await nyc.writeCoverageFile();
            await nyc.report();
        }
    }
}


