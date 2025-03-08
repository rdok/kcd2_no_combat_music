#!/bin/bash

projectRoot="$(dirname "$(realpath "$0")")/.."
gamePath="/mnt/c/Steam/steamapps/common/KingdomComeDeliverance2"
exeName="KingdomCome.exe"
exeSubPath="Bin/Win64MasterMasterSteamPGO/${exeName}"
modsPath="${gamePath}/Mods"
modOrderFile="$modsPath/mod_order.txt"
defaultVersion="main"

version="${1:-$defaultVersion}"

taskkill.exe /F /IM "${exeName}"
sleep 1

echo "Running dev build and deploy (version: $version)..."

cd "$projectRoot" || { echo "ERROR: Cannot change to $projectRoot"; exit 1; }

manifestFile="$projectRoot/src/mod.manifest"
modIdentifier=$(grep -oP '<modid>\K[^<]+' "$manifestFile")
modVersion=$(grep -oP '<version>\K[^<]+' "$manifestFile")
[ "$modIdentifier" ] && [ "$modVersion" ] || { echo "ERROR: Could not extract modid or version from $manifestFile"; exit 1; }

zipFileName="${modIdentifier}_${version}_${modVersion}.zip"
zipFilePath="./$zipFileName"

docker compose run --rm -e MODE="dev" -e VERSION="$version" ci-cd
[ -f "$zipFilePath" ] || { echo "ERROR: ZIP $zipFilePath not found!"; exit 1; }
docker compose down ci-cd -v

modOutputDirectory="$modsPath/$modIdentifier"

[ -d "$modOutputDirectory" ] && rm -rf "$modOutputDirectory"
mkdir -p "$modOutputDirectory"
sevenZipBinary="$projectRoot/node_modules/7z-bin/linux/7zzs"
"$sevenZipBinary" x "$zipFilePath" -o"$modOutputDirectory" -y || { echo "ERROR: Failed to extract $zipFilePath with 7zzs"; exit 1; }
echo "Extracted $zipFileName to $modOutputDirectory"

if [ -f "$modOrderFile" ]; then modOrder=$(cat "$modOrderFile" | tr -d '\r'); else modOrder=""; fi
echo "$modOrder" | grep -Fxq "$modIdentifier" || { echo "$modOrder" > "$modOrderFile"; echo "$modIdentifier" >> "$modOrderFile"; echo "Added $modIdentifier to $modOrderFile"; }

${gamePath}/${exeSubPath}