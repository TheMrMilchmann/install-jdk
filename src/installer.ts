/*
 * Copyright (c) 2018 GitHub, Inc. and contributors
 * Copyright (c) 2019-2020 Leon Linhart
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
let tempDirectory = process.env["RUNNER_TEMP"] || "";

import * as core from "@actions/core";
import * as io from "@actions/io";
import * as exec from "@actions/exec";
import * as tc from "@actions/tool-cache";
import * as fs from "fs";
import * as path from "path";

const IS_WINDOWS = process.platform === "win32";
let OS = IS_WINDOWS
  ? "windows"
  : process.platform === "darwin"
  ? "mac"
  : "linux";

if (!tempDirectory) {
  let baseLocation;

  if (IS_WINDOWS) {
    // On windows use the USERPROFILE env variable
    baseLocation = process.env["USERPROFILE"] || "C:\\";
  } else if (process.platform === "darwin") {
    baseLocation = "/Users";
  } else {
    baseLocation = "/home";
  }

  tempDirectory = path.join(baseLocation, "actions", "temp");
}

export async function installJDK(
  version: string,
  arch: string,
  source: string,
  archiveExtension: string,
  targets: string
): Promise<void> {
  const cacheEntry = `jdk-${version}`; // Trick the caching system for more flexibility
  let toolPath = tc.find(cacheEntry, "1.0.0", arch);

  if (toolPath) {
    core.debug(`JDK found in cache: ${toolPath}`);
  } else {
    let jdkFile;
    let jdkDir;
    let compressedFileExtension;

    if (source) {
      core.debug(`Attempting to use JDK from source: ${source}`);

      /*
       * Source could refer to
       * - an URL (discovered by http or https protocol prefix),
       * - a directory, or
       * - an archive file
       */
      if (source.startsWith("http://") || source.startsWith("https://")) {
        if (!archiveExtension)
          core.error(
            "archiveExtension must be set explicitly when source is an URL"
          );

        core.debug(`Downloading JDK from explicit source: ${source}`);
        jdkFile = await tc.downloadTool(source);
        compressedFileExtension = archiveExtension;
      } else {
        jdkFile = source;
      }
    } else {
      core.debug("Downloading JDK from AdoptOpenJDK");
      jdkFile = await tc.downloadTool(
        `https://api.adoptopenjdk.net/v2/binary/releases/openjdk${normalize(
          version
        )}?openjdk_impl=hotspot&os=${OS}&arch=${arch}&release=latest&type=jdk`
      );
      compressedFileExtension =
        archiveExtension || IS_WINDOWS ? ".zip" : ".tar";
    }

    compressedFileExtension =
      compressedFileExtension || getNormalizedCompressedFileExtension(jdkFile);

    let tempDir: string = path.join(
      tempDirectory,
      "temp_" + Math.floor(Math.random() * 2000000000)
    );
    jdkDir = await decompressArchive(jdkFile, compressedFileExtension, tempDir);
    toolPath = await tc.cacheDir(jdkDir, cacheEntry, "1.0.0", arch);
  }

  targets.split(";").forEach(function(value) {
    if (value == "JAVA_HOME") core.addPath(path.join(toolPath, "bin"));
    core.exportVariable(value, toolPath);
  });
}

function getNormalizedCompressedFileExtension(file: string): string {
  if (file.endsWith(".tar") || file.endsWith(".tar.gz")) {
    return ".tar";
  } else if (file.endsWith(".zip")) {
    return ".zip";
  } else {
    return ".7z";
  }
}

async function decompressArchive(
  repoRoot: string,
  fileEnding: string,
  destinationFolder: string
): Promise<string> {
  await io.mkdirP(destinationFolder);

  const jdkFile = path.normalize(repoRoot);
  const stats = fs.statSync(jdkFile);

  if (stats.isFile()) {
    await extractFiles(jdkFile, fileEnding, destinationFolder);

    const jdkDirectory = path.join(
      destinationFolder,
      fs.readdirSync(destinationFolder)[0]
    );
    await unpackJars(jdkDirectory, path.join(jdkDirectory, "bin"));

    return jdkDirectory;
  } else if (stats.isDirectory()) {
    return jdkFile;
  } else {
    throw new Error(
      `Argument is neither a directory, nor a supported archive: ${jdkFile}`
    );
  }
}

async function extractFiles(
  file: string,
  fileEnding: string,
  destinationFolder: string
): Promise<void> {
  const stats = fs.statSync(file);
  if (!stats) {
    throw new Error(`Failed to extract ${file} - it doesn"t exist`);
  } else if (stats.isDirectory()) {
    throw new Error(`Failed to extract ${file} - it is a directory`);
  }

  if (fileEnding == ".tar") {
    core.debug(`Decompressing .tar archive: ${file}`);
    await tc.extractTar(file, destinationFolder);
  } else if (fileEnding == ".zip") {
    core.debug(`Decompressing .zip archive: ${file}`);
    await tc.extractZip(file, destinationFolder);
  } else {
    core.debug(`Attempting to decompress unknown archive using 7z: ${file}`);
    await tc.extract7z(file, destinationFolder);
  }
}

// This method recursively finds all .pack files under fsPath and unpacks them with the unpack200 tool
async function unpackJars(fsPath: string, javaBinPath: string) {
  if (fs.existsSync(fsPath)) {
    if (fs.lstatSync(fsPath).isDirectory()) {
      for (const file in fs.readdirSync(fsPath)) {
        const curPath = path.join(fsPath, file);
        await unpackJars(curPath, javaBinPath);
      }
    } else if (path.extname(fsPath).toLowerCase() === ".pack") {
      // Unpack the pack file synchronously
      const p = path.parse(fsPath);
      const toolName = IS_WINDOWS ? "unpack200.exe" : "unpack200";
      const args = IS_WINDOWS ? '-r -v -l ""' : "";
      const name = path.join(p.dir, p.name);
      await exec.exec(`"${path.join(javaBinPath, toolName)}"`, [
        `${args} "${name}.pack" "${name}.jar"`
      ]);
    }
  }
}

function normalize(version: string): string {
  if (version == "1.8") return "8";
  return version;
}
