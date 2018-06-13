const fs = require('fs-extra');
const path = require('path');
const download = require('download');
const decompress = require('decompress');

const SSP_SERVER_JAR_NAME = 'org.jboss.tools.ssp.distribution-0.0.9-SNAPSHOT.zip';
const SSP_SERVER_JAR_URL = 'http://download.jboss.org/jbosstools/adapters/snapshots/org.jboss.tools.ssp.distribution-0.0.9-SNAPSHOT.zip';

function clean() {
    return Promise.resolve()
        .then(()=>fs.remove('server'))
        .then(()=>fs.pathExists(SSP_SERVER_JAR_NAME))
        .then((exists)=>(exists?fs.unlink(SSP_SERVER_JAR_NAME):undefined));
}

Promise.resolve()
    .then(clean)
    .then(()=> download(SSP_SERVER_JAR_URL, './'))
    .then(()=> decompress(SSP_SERVER_JAR_NAME, './server', { strip: 1 }))
    .catch((err)=>{ throw err; });

