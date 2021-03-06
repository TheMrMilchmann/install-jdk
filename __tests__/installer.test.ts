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
import io = require("@actions/io");
import fs = require("fs");
import path = require("path");
import child_process = require("child_process");

const toolDir = path.join(__dirname, "runner", "tools");
const tempDir = path.join(__dirname, "runner", "temp");
const javaDir = path.join(__dirname, "runner", "java");

process.env["RUNNER_TOOL_CACHE"] = toolDir;
process.env["RUNNER_TEMP"] = tempDir;
import * as installer from "../src/installer";

let javaFilePath = "";
let javaUrl = "";
let javaArchiveExtension = "";

if (process.platform === "win32") {
    javaFilePath = path.join(javaDir, "java_win.zip");
    javaUrl = "https://download.java.net/java/GA/jdk12/33/GPL/openjdk-12_windows-x64_bin.zip";
    javaArchiveExtension = ".zip"
} else if (process.platform === "darwin") {
    javaFilePath = path.join(javaDir, "java_mac.tar.gz");
    javaUrl = "https://download.java.net/java/GA/jdk12/33/GPL/openjdk-12_osx-x64_bin.tar.gz";
    javaArchiveExtension = ".tar"
} else {
    javaFilePath = path.join(javaDir, "java_linux.tar.gz");
    javaUrl = "https://download.java.net/java/GA/jdk12/33/GPL/openjdk-12_linux-x64_bin.tar.gz";
    javaArchiveExtension = ".tar"
}

describe("installer tests", () => {
    beforeAll(async () => {
        await io.rmRF(toolDir);
        await io.rmRF(tempDir);
        if (!fs.existsSync(`${javaFilePath}.complete`)) {
            // Download java
            await io.mkdirP(javaDir);

            console.log("Downloading java");
            child_process.execSync(`curl "${javaUrl}" > "${javaFilePath}"`);
            // Write complete file so we know it was successful
            fs.writeFileSync(`${javaFilePath}.complete`, "content");
        }
    }, 300000);

    afterAll(async () => {
        try {
            await io.rmRF(toolDir);
            await io.rmRF(tempDir);
        } catch {
            console.log("Failed to remove test directories");
        }
    }, 100000);

    it("Installs version of Java from jdkFile if no matching version is installed", async () => {
        await installer.installJDK("12", "x64", javaFilePath, javaArchiveExtension, "JAVA_HOME");
        const JavaDir = path.join(toolDir, "jdk-12", "1.0.0", "x64");

        expect(fs.existsSync(`${JavaDir}.complete`)).toBe(true);
        expect(fs.existsSync(path.join(JavaDir, "bin"))).toBe(true);
    }, 100000);

    it("Throws if invalid directory to jdk", async () => {
        let thrown = false;
        try {
            await installer.installJDK("1000", "x64", "bad path", ".zip", "JAVA_HOME");
        } catch {
            thrown = true;
        }
        expect(thrown).toBe(true);
    });

    it("Downloads java if no file given", async () => {
        await installer.installJDK("8", "x64", "", "", "JAVA_HOME");
        const JavaDir = path.join(toolDir, "jdk-8", "1.0.0", "x64");

        expect(fs.existsSync(`${JavaDir}.complete`)).toBe(true);
        expect(fs.existsSync(path.join(JavaDir, "bin"))).toBe(true);
    }, 100000);

    it("Downloads java with 1.x syntax", async () => {
        await installer.installJDK("1.8", "x64", "", javaArchiveExtension, "JAVA_HOME");
        const JavaDir = path.join(toolDir, "jdk-1.8", "1.0.0", "x64");

        expect(fs.existsSync(`${JavaDir}.complete`)).toBe(true);
        expect(fs.existsSync(path.join(JavaDir, "bin"))).toBe(true);
    }, 100000);

    /*
    it("Downloads java with normal semver syntax", async () => {
        await installer.installJDK("9.0.x", "x64", "", "", "");
        const JavaDir = path.join(toolDir, "jdk", "9.0.7", "x64");

        expect(fs.existsSync(`${JavaDir}.complete`)).toBe(true);
        expect(fs.existsSync(path.join(JavaDir, "bin"))).toBe(true);
    }, 100000);
     */

    it("Throws if invalid directory to jdk", async () => {
        let thrown = false;
        try {
            await installer.installJDK("1000", "x64", "bad path", "", "JAVA_HOME");
        } catch {
            thrown = true;
        }
        expect(thrown).toBe(true);
    });

    it("Uses version of Java installed in cache", async () => {
        const JavaDir: string = path.join(toolDir, "jdk", "250.0.0", "x64");
        await io.mkdirP(JavaDir);
        fs.writeFileSync(`${JavaDir}.complete`, "hello");
        // This will throw if it doesn""t find it in the cache (because no such version exists)
        await installer.installJDK(
            "250",
            "x64",
            "path shouldnt matter, found in cache",
            "",
            "JAVA_HOME"
        );
        return;
    });

    it("Doesnt use version of Java that was only partially installed in cache", async () => {
        const JavaDir: string = path.join(toolDir, "jdk", "251.0.0", "x64");
        await io.mkdirP(JavaDir);
        let thrown = false;
        try {
            // This will throw if it doesn""t find it in the cache (because no such version exists)
            await installer.installJDK("251", "x64", "bad path", "", "JAVA_HOME");
        } catch {
            thrown = true;
        }
        expect(thrown).toBe(true);
        return;
    });
});