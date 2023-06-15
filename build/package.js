const fs = require('fs-extra');
const download = require('download');
const decompress = require('decompress');

const qualifier = process.env.RSP_QUALIFIER === 'snapshots' ? 'snapshots' : 'stable';
console.log("The qualifier is " + qualifier);
const RSP_SERVER_JAR_NAME = 'org.jboss.tools.rsp.distribution-latest.zip';
const RSP_SERVER_JAR_URL = `http://download.jboss.org/jbosstools/adapters/${qualifier}/rsp-server/${RSP_SERVER_JAR_NAME}`;

function clean() {
    return Promise.resolve()
        .then(()=>fs.remove('server'))
        .then(()=>fs.pathExists(RSP_SERVER_JAR_NAME))
        .then((exists)=>(exists?fs.unlink(RSP_SERVER_JAR_NAME):undefined));
}

Promise.resolve()
    .then(clean)
    .then(()=> console.log(`Downloading ${RSP_SERVER_JAR_URL}`))
    .then(()=> download(RSP_SERVER_JAR_URL, './'))
    .then(()=> decompress(RSP_SERVER_JAR_NAME, './server', { strip: 1 }))
    .catch((err)=>{ throw err; });
