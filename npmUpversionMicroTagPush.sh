#!/bin/sh

repoOwnerAndName=redhat-developer/vscode-server-connector
curBranch=`git rev-parse --abbrev-ref HEAD`
ghtoken=`cat ~/.keys/gh_access_token`
argsPassed=$#
echo "args: " $argsPassed
if [ "$argsPassed" -eq 1 ]; then
	debug=1
	echo "YOU ARE IN DEBUG MODE. Changes will NOT be pushed upstream"
else
	echo "The script is live. All changes will be pushed, deployed, etc. Live."
	debug=0
fi
read -p "Press enter to continue"


apiStatus=`git status -s | wc -l`
if [ $apiStatus -ne 0 ]; then
   echo "This repository has changes and we won't be able to auto upversion. Please commit or stash your changes and try again"
   exit 1
fi

echo ""
echo "These are the commits for the release"
commits=`git log --color --pretty=format:'%h - %s' --abbrev-commit | grep -n -m 1 "Upversion to " |sed  's/\([0-9]*\).*/\1/' | tail -n 1`
commitMsgs=`git log --color --pretty=format:'%h - %s' --abbrev-commit | head -n $commits`
echo "$commitMsgs"
read -p "Press enter to continue"



echo "Let's just run some builds and stuff"
read -p "Press enter to continue"
rm -rf server/
npm install
npm run build
echo "Did the build work?"
read -p "Press enter to continue"

echo ""
echo ""
msgLine1=`ls server/bundle/*spi* | cut -f 2 -d "_" | cut -f 1,2,3 -d "." | awk '{ print "Now using the " $0 " release of rsp-server. "}'`
echo $msgLine1
echo ""
echo "Let's package it now"
read -p "Press enter to continue"

vsce package
echo "Did the package work?"
read -p "Press enter to continue"
echo ""
echo ""
echo "Go to https://github.com/redhat-developer/vscode-server-connector/actions/workflows/gh-actions.yml and trigger a build there first."
echo "Come back when that's green."
read -p "Press enter to continue"

echo "It's green? Run it again with a release flag"
echo "Did it succeed? Great. Let's continue with tagging and more"
read -p "Press enter to continue"



echo "Old version is $oldver"
echo "Let's tag the release"

oldver=`cat package.json  | grep "\"version\":" | cut -f 2 -d ":" | sed 's/"//g' | sed 's/,//g' | awk '{$1=$1};1'`
oldVerUnderscore=`echo $oldver | sed 's/\./_/g'`
vOldVerUnderscoreFinal=v$oldVerUnderscore.Final
git tag $vOldVerUnderscoreFinal
if [ "$debug" -eq 0 ]; then
	git push origin $vOldVerUnderscoreFinal
else 
	echo git push origin $vOldVerUnderscoreFinal
fi

echo "We've tagged."
echo "Now we should actually create some releases"

oldVerFinal=$oldver.Final
echo "Making a release on github for $oldVerFinal"
commitMsgsClean=`git log --color --pretty=format:'%s' --abbrev-commit | head -n $commits | awk '{ print " * " $0;}' | awk '{printf "%s\\\\n", $0}' | sed 's/"/\\"/g'`

msgLine1=`ls server/bundle/*spi* | cut -f 2 -d "_" | cut -f 1,2,3 -d "." | awk '{ print "Now using the " $0 " release of rsp-server. "}'`
msgLine2=`ls server/bundle/*spi* | cut -f 2 -d "_" | cut -f 1,2,3 -d "." | sed 's/\./_/g' | awk '{ print "See rsp-server CHANGELOG at https://github.com/redhat-developer/rsp-server/releases/tag/v" $0;}'`
commitMsgsFinal="$msgLine1\\\\n$msgLine2\\\\n$commitMsgsClean"

echo "Release commit log: $commitMsgsFinal"
read -p "Press enter to continue"

createReleasePayload="{\"tag_name\":\"$vOldVerUnderscoreFinal\",\"target_commitish\":\"$curBranch\",\"name\":\"$oldVerFinal\",\"body\":\"Release of $oldVerFinal:\\n\\n"$commitMsgsFinal"\",\"draft\":false,\"prerelease\":false,\"generate_release_notes\":false}"

if [ "$debug" -eq 0 ]; then
	curl -L \
	  -X POST \
	  -H "Accept: application/vnd.github+json" \
	  -H "Authorization: Bearer $ghtoken"\
	  -H "X-GitHub-Api-Version: 2022-11-28" \
	  https://api.github.com/repos/$repoOwnerAndName/releases \
	  -d "$createReleasePayload" | tee createReleaseResponse.json
else 
	echo curl -L \
	  -X POST \
	  -H "Accept: application/vnd.github+json" \
	  -H "Authorization: Bearer $ghtoken"\
	  -H "X-GitHub-Api-Version: 2022-11-28" \
	  https://api.github.com/repos/$repoOwnerAndName/releases \
	  -d "$createReleasePayload"
fi

echo "Please go verify the release looks correct. We will add the asset next"
read -p "Press enter to continue"

assetUrl=`cat createReleaseResponse.json | grep assets_url | cut -c 1-17 --complement | rev | cut -c3- | rev | sed 's/api.github.com/uploads.github.com/g'`
rm createReleaseResponse.json
zipFileName=` ls -1 -t *.vsix  | head -n 1`
echo "Running command to add artifact to release: "
	echo curl -L \
	  -X POST \
	  -H "Accept: application/vnd.github+json" \
	  -H "Authorization: Bearer $ghtoken"\
	  -H "X-GitHub-Api-Version: 2022-11-28" \
	  -H "Content-Type: application/octet-stream" \
	  $assetUrl?name=$zipFileName \
	  --data-binary "@$zipFileName"
if [ "$debug" -eq 0 ]; then
	curl -L \
	  -X POST \
	  -H "Accept: application/vnd.github+json" \
	  -H "Authorization: Bearer $ghtoken"\
	  -H "X-GitHub-Api-Version: 2022-11-28" \
	  -H "Content-Type: application/octet-stream" \
	  $assetUrl?name=$zipFileName \
	  --data-binary "@$zipFileName"
fi
echo ""
echo "Please go verify the release looks correct and the distribution was added correctly."
read -p "Press enter to continue"

echo "Now we need to upversion"
newLastSegment=`echo $oldver | cut -f 3 -d "." | awk '{ print $0 + 1;}' | bc`
newverPrefix=`echo $oldver | cut -f 1,2 -d "."`
newver=$newverPrefix.$newLastSegment
echo "New version is $newver"

echo "Updating package.json with new version"
cat package.json | sed "s/  \"version\": \"$oldver\",/  \"version\": \"$newver\",/g" > package2
mv package2 package.json
echo "Running npm install"
npm install

echo "Committing and pushing to main"
git commit -a -m "Upversion to $newver - Development Begins" --signoff

if [ "$debug" -eq 0 ]; then
	git push origin $curBranch
else 
	echo git push origin $curBranch
fi



