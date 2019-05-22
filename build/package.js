const fs = require('fs-extra');
const download = require('download');
const decompress = require('decompress');

const RSP_SERVER_JAR_NAME = 'org.jboss.tools.rsp.distribution-0.16.0-SNAPSHOT.zip';
const RSP_SERVER_JAR_URL = `http://download.jboss.org/jbosstools/adapters/snapshots/rsp-server/${RSP_SERVER_JAR_NAME}`;

function clean() {
    return Promise.resolve()
        .then(()=>fs.remove('server'))
        .then(()=>fs.pathExists(RSP_SERVER_JAR_NAME))
        .then((exists)=>(exists?fs.unlink(RSP_SERVER_JAR_NAME):undefined));
}

Promise.resolve()
    .then(clean)
    .then(()=> download(RSP_SERVER_JAR_URL, './'))
    .then(()=> decompress(RSP_SERVER_JAR_NAME, './server', { strip: 1 }))
    .catch((err)=>{ throw err; });
