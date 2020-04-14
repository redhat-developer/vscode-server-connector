#!/usr/bin/env groovy

node('rhel8'){
	stage('Checkout repo') {
		deleteDir()
		git url: "https://github.com/${params.FORK}/vscode-server-connector.git", branch: params.BRANCH
	}

	stage('Install requirements') {
		def nodeHome = tool 'nodejs-8.11.1'
		env.PATH="${env.PATH}:${nodeHome}/bin"
		sh "npm install -g typescript vsce"
	}

	stage('Build') {
		sh "npm install"
		if(publishToMarketPlace.equals('false')) {
			def baseUrl = "https://download.jboss.org/jbosstools/adapters/snapshots/vscode-middleware-tools"
			sh "wget ${baseUrl}/vscode-server-connector-api/vscode-server-connector-api-latest.tgz"
			sh "npm install vscode-server-connector-api-latest.tgz"
		}
		sh "npm run build"
	}

	withEnv(['JUNIT_REPORT_PATH=report.xml', 'CODE_TESTS_WORKSPACE=c:/unknown']) {
        stage('Test') {
    		wrap([$class: 'Xvnc']) {
    			sh "npm test --silent"
				sh "npm run ui-test"
    			//cobertura coberturaReportFile: 'coverage/cobertura-coverage.xml'
    			junit 'report.xml'
    		}
        }
	}

	stage('Package') {
		try {
			def packageJson = readJSON file: 'package.json'
			sh "vsce package -o adapters-${packageJson.version}-${env.BUILD_NUMBER}.vsix"
		}
		finally {
			archiveArtifacts artifacts: '*.vsix'
		}
	}

	if(params.UPLOAD_LOCATION) {
		stage('Snapshot') {
			def filesToPush = findFiles(glob: '**.vsix')
			sh "rsync -Pzrlt --rsh=ssh --protocol=28 ${filesToPush[0].path} ${UPLOAD_LOCATION}/snapshots/vscode-middleware-tools/"
		}
	}

	if(publishToMarketPlace.equals('true')){
		timeout(time:5, unit:'DAYS') {
			input message:'Approve deployment?', submitter: 'rstryker'
		}

		stage("Publish to Marketplace") {
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
