/*******************************************************************************
 * Copyright (c) 2019 Red Hat, Inc. Distributed under license by Red Hat, Inc.
 * All rights reserved. This program is made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is
 * available at http://www.eclipse.org/legal/epl-v20.html
 * 
 * Contributors: Red Hat, Inc.
 ******************************************************************************/

import * as testRunner from 'vscode/lib/testrunner';

process.on('unhandledRejection', (err) => {
    console.log('Unhandled rejection:', err);
});

// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info
testRunner.configure({
    ui: 'tdd',
    useColors: true,
    timeout: 50000,
    slow: 50000
});

module.exports = testRunner;
