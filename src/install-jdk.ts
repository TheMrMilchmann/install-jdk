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
import * as core from "@actions/core";
import * as installer from "./installer";

async function run() {
    try {
        let version = core.getInput("version", { required: true });
        let arch = core.getInput("architecture", { required: false });
        let source = core.getInput("source", { required: false });

        let archiveExtension = core.getInput("archiveExtension", { required: false });
        if (archiveExtension
            && archiveExtension != ".zip"
            && archiveExtension != ".tar"
            && archiveExtension != ".7z") {
            core.error(`archiveExtension should be one of [.zip, .tar, .7z]. Found: ${archiveExtension}`);
        }

        let targets = core.getInput("targets", { required: false });

        if (!arch) arch = "x64";
        if (!targets) targets = "JAVA_HOME";

        await installer.installJDK(version, arch, source, archiveExtension, targets);

//        const matchersPath = path.join(__dirname, '..', '.github');
//        console.log(`##[add-matcher]${path.join(matchersPath, 'java.json')}`);
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();