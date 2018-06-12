const child_process = require('child_process');
const pify = require('pify');
let unzip = require('unzip-stream');
let fs = require('fs-extra');
let path = require('path');
let mkdirp = require('mkdirp');
const download = require('download');



let Downloadssp = function() {
    return new Promise((resolve, reject)=>{
        return download('http://download.jboss.org/jbosstools/adapters/snapshots/org.jboss.tools.ssp.distribution-0.0.9-SNAPSHOT.zip', './').then(()=>{
            resolve(true);
          }).catch(()=>{
            resolve(false);
          });
    });
}

let Unzip = function(zipFile, extractTo, prefix) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(zipFile).pipe(unzip.Parse())
            .on('entry', (entry)=> {
                try {
                var fileName = entry.path;
                let f = fileName.substring(fileName.indexOf('/'));
                let dest = path.join(extractTo, ...f.split('/'));
                if (entry.type ) {
                    mkdirp.sync(dest);
                    entry.pipe(fs.createWriteStream(dest));
                } else {
                    mkdirp.sync(dest);
                    entry.autodrain();
                }
                } catch(err) {
                    reject(err);
                }
            }).on('error', (error) => {
                reject(error);
            }).on('close', () => {
                resolve();
            });
    });
}


let Unzipfile = function() {
    return new Promise((resolve, reject)=>{
        Unzip('./org.jboss.tools.ssp.distribution-0.0.9-SNAPSHOT.zip', './server').then(()=>{
            resolve();
        });
    }).catch(()=>{
        resolve(false);        
    });
}

Downloadssp()
.then(()=>{
    return Unzipfile();
});

