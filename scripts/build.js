#!/usr/bin/env node

const {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  cpSync,
  readdirSync,
  statSync,
  renameSync,
} = require("fs");
const { join, resolve, relative } = require("path");
const { execSync } = require("child_process");
const { argv } = require("process");

const args = argv.slice(2);
const environment =
  args.find((arg) => arg.startsWith("--env="))?.split("=")[1] ||
  process.env.MODE ||
  "dev";
const version =
  args.find((arg) => arg.startsWith("--version="))?.split("=")[1] ||
  process.env.VERSION ||
  "main";
const isHelpRequested = args.includes("--help");

const validEnvironments = ["prod", "dev"];
const validVersions = ["main", "lorem-ipsum"];

if (isHelpRequested) {
  console.log(`
Usage: node build.js [--env=prod|dev] [--version=main|lorem-ipsum] [--help]
--env=prod|dev          Sets the environment (default: prod).
--version=main|lorem-ipsum   Sets the version (default: main).
--help                  Displays this help message.
`);
  process.exit(0);
}

if (!validEnvironments.includes(environment)) {
  console.error(
    `ERROR: Invalid --env value '${environment}'. Must be one of: ${validEnvironments.join(", ")}`,
  );
  process.exit(1);
}

if (!validVersions.includes(version)) {
  console.error(
    `ERROR: Invalid --version value '${version}'. Must be one of: ${validVersions.join(", ")}`,
  );
  process.exit(1);
}

const rootDirectory = resolve(__dirname, "..");
const sourceDirectory = join(rootDirectory, "src");
const manifestFile = join(sourceDirectory, "mod.manifest");
const temporaryBuildDirectory = join(rootDirectory, "temp_build");

if (!existsSync(manifestFile)) {
  console.error("ERROR: mod.manifest not found in src!");
  process.exit(1);
}

const manifestContent = readFileSync(manifestFile, "utf8");
const modIdentifier = /<modid>(.+?)<\/modid>/.exec(manifestContent)?.[1];
const modVersion = /<version>(.+?)<\/version>/.exec(manifestContent)?.[1];
const modName = /<name>(.+?)<\/name>/.exec(manifestContent)?.[1];

if (!modIdentifier || !modVersion || !modName) {
  console.error("ERROR: Missing required fields in mod.manifest.");
  process.exit(1);
}

function cleanBuildDirectory() {
  rmSync(temporaryBuildDirectory, { recursive: true, force: true });
  mkdirSync(temporaryBuildDirectory, { recursive: true });
}

function prepareBuild() {
  cpSync(sourceDirectory, temporaryBuildDirectory, { recursive: true });
}

function removeNonProductionFiles() {
  const scriptsDirectory = join(temporaryBuildDirectory, "Data", "Scripts");
  existsSync(scriptsDirectory) &&
    rmSync(scriptsDirectory, { recursive: true, force: true });

  const libsDirectory = join(temporaryBuildDirectory, "Data", "Libs");
  existsSync(libsDirectory) &&
    rmSync(libsDirectory, { recursive: true, force: true });
}

function compressToPak(dataSourceDirectory, pakOutputPath) {
  // Build file list (Python's build_filelist)
  const fileList = [];

  function buildFileList(dir) {
    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        buildFileList(fullPath); // Recursive
      } else if (!fullPath.toLowerCase().endsWith(".pak")) {
        // Skip nested paks
        fileList.push(fullPath);
      }
    }
  }

  buildFileList(dataSourceDirectory);

  if (fileList.length === 0) {
    console.error(`ERROR: No files found in '${dataSourceDirectory}' to pack.`);
    process.exit(1);
  }

  // Pak creation with size splitting
  const maxSizeBytes = 2 * 1024 * 1024 * 1024; // 2GB limit (optional)
  let fileIdx = 0;
  let pakPartNo = 0;
  let totalFiles = fileList.length;

  while (fileIdx < totalFiles) {
    let pakPath = pakOutputPath;
    if (pakPartNo > 0) {
      pakPath = pakOutputPath.replace(".pak", `-part${pakPartNo}.pak`);
    }

    let pakSize = 0;
    const filesToPack = [];

    for (let i = fileIdx; i < totalFiles; i++) {
      const file = fileList[i];
      const fileSize = statSync(file).size;
      if (pakSize + fileSize > maxSizeBytes) break;
      pakSize += fileSize;
      const relPath = relative(dataSourceDirectory, file);
      filesToPack.push(relPath); // Use relative paths
      fileIdx++;
    }

    // Updated zip command with -9 (max compression) and -X (no extra attributes) for KCD compatibility
    const cmd = `zip -r -9 -X "${pakPath}" ${filesToPack.map((f) => `"${f}"`).join(" ")}`;
    console.log(`Creating pak part ${pakPartNo}: ${cmd}`);
    execSync(cmd, { cwd: dataSourceDirectory, stdio: "inherit" });

    if (!existsSync(pakPath)) {
      console.error(`ERROR: Failed to create '${pakPath}'.`);
      process.exit(1);
    }

    if (fileIdx < totalFiles) {
      if (pakPartNo === 0) {
        // Rename first pak to -part0
        const newPath = pakOutputPath.replace(".pak", "-part0.pak");
        renameSync(pakPath, newPath);
      }
      pakPartNo++;
    }
  }
}

function packData() {
  const dataDirectory = join(temporaryBuildDirectory, "Data");
  const modPakFile = join(dataDirectory, `${modIdentifier}.pak`);
  compressToPak(dataDirectory, modPakFile);
  removeNonProductionFiles();
}

function packMod(outputFileName) {
  const finalZipPath = join(
    rootDirectory,
    `${outputFileName}_${modVersion}.zip`,
  );
  if (existsSync(finalZipPath)) rmSync(finalZipPath);

  const sevenZipBinary = join(
    rootDirectory,
    "node_modules",
    "7z-bin",
    "linux",
    "7zzs",
  );
  const sevenZipCommand = `"${sevenZipBinary}" a "${finalZipPath}" "${temporaryBuildDirectory}/*"`;
  console.log(`Zipping final mod: ${sevenZipCommand}`);
  execSync(sevenZipCommand);

  rmSync(temporaryBuildDirectory, { recursive: true, force: true });

  console.log(`Built ${outputFileName} mod: ${finalZipPath}`);
  console.log(`ZIP_FILE:${finalZipPath}`);
  return finalZipPath;
}

if (environment === "prod") {
  console.log(`Building production version (${version})...`);
  cleanBuildDirectory();
  prepareBuild();
  packData();
  packMod(`${modName}_${version}`);
} else if (environment === "dev") {
  console.log(`Building development version (${version})...`);
  cleanBuildDirectory();
  prepareBuild();
  packData();
  packMod(`${modName}_${version}`);
}
