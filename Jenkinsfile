#!/usr/bin/env groovy

node('rhel7'){
	stage('Build RSP Server') {
		deleteDir()
		dir('rsp-server') {
			git url: 'https://github.com/redhat-developer/rsp-server.git'

			def mvnHome = tool 'maven3-latest'
			env.PATH="${env.PATH}:${mvnHome}/bin"

			sh 'mvn clean install'
			sh 'mvn clean package -f distribution/pom.xml'
		}
	}

	stage('Setup') {
		dir('adapters') {
			git url: 'https://github.com/redhat-developer/vscode-adapters.git'
		
			def nodeHome = tool 'nodejs-8.11.1'
			env.PATH="${env.PATH}:${nodeHome}/bin"
			sh "npm install -g typescript vsce"
		}
	}

	stage('Build Extension') {
		dir('adapters') {
			sh "npm install"
			sh "unzip ${WORKSPACE}/rsp-server/distribution/target/org.jboss.tools.rsp.distribution*.zip"
			sh "mv rsp-distribution server"
			sh "npm run vscode:prepublish"
		}
	}

	withEnv(['JUNIT_REPORT_PATH=report.xml']) {
        stage('Test Extension') {
			dir('adapters') {
				wrap([$class: 'Xvnc']) {
					sh "npm test --silent"
					//cobertura coberturaReportFile: 'coverage/cobertura-coverage.xml'
					junit 'report.xml'
				}
			}
        }
	}

	stage('Package Extension') {
		dir('adapters') {
			def packageJson = readJSON file: 'package.json'
			sh "vsce package -o adapters-${packageJson.version}-${env.BUILD_NUMBER}.vsix"
		}
	}

	if(params.UPLOAD_LOCATION) {
		stage('Snapshot') {
			dir('adapters') {
				def filesToPush = findFiles(glob: '**.vsix')
				sh "rsync -Pzrlt --rsh=ssh --protocol=28 ${filesToPush[0].path} ${UPLOAD_LOCATION}/snapshots/vscode-middleware-tools/"
			}
		}
	}

	if(publishToMarketPlace.equals('true')) {
		timeout(time:5, unit:'DAYS') {
			input message:'Approve deployment?', submitter: 'jrichter'
		}

		stage("Publish to Marketplace") {
			dir('adapters') {
				withCredentials([[$class: 'StringBinding', credentialsId: 'vscode_java_marketplace', variable: 'TOKEN']]) {
					def vsix = findFiles(glob: '**.vsix')
					sh 'vsce publish -p ${TOKEN} --packagePath' + " ${vsix[0].path}"
				}
				archive includes:"**.vsix"

				stage "Promote the build to stable"
				def vsix = findFiles(glob: '**.vsix')
				sh "rsync -Pzrlt --rsh=ssh --protocol=28 ${vsix[0].path} ${UPLOAD_LOCATION}/stable/vscode-middleware-tools/"
			}
		}
	}
}
