const fs = require('fs-extra');
const download = require('download');
const decompress = require('decompress');

const qualifier = process.env.RSP_QUALIFIER === 'snapshots' ? 'snapshots' : 'stable';
console.log("The qualifier is " + qualifier);
const RSP_PREFIX = `http://download.jboss.org/jbosstools/adapters/${qualifier}/rsp-server`;
const RSP_SERVER_LATEST = 'LATEST';
const RSP_SERVER_LATEST_URL = `${RSP_PREFIX}/${RSP_SERVER_LATEST}`;
const RSP_SERVER_JAR_NAME = 'org.jboss.tools.rsp.distribution-latest.zip';
const RSP_SERVER_JAR_URL = `${RSP_PREFIX}/${RSP_SERVER_JAR_NAME}`;


function clean() {
    return Promise.resolve()
        .then(()=>fs.remove('server'))
        .then(()=>fs.pathExists(RSP_SERVER_JAR_NAME))
        .then((exists)=>(exists?fs.unlink(RSP_SERVER_JAR_NAME):undefined));
}

Promise.resolve()
    .then(clean)
    .then(()=> console.log(`Downloading ${RSP_SERVER_LATEST_URL}`))
    .then(()=> download(RSP_SERVER_LATEST_URL, './'))
    .then(()=> fs.readFileSync(RSP_SERVER_LATEST).toString())
    .then((v)=> { console.log(v); return v;})
    .then((v)=> v.split('\n')[1])
    .then((v)=> v.split('=')[1])
    .then((v)=> {console.log("downloading " + v); return v;})
    .then((v)=> {
                    download(v, './')
		    .then(()=>v.split('/').reverse()[0])
                    .then((x)=>decompress(x, './server', { strip: 1}))
	            .catch((err)=>{throw err;});
	        })
    .catch((err)=>{ throw err; });
