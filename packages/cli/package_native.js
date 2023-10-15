#!/usr/bin/env node

/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const fs = require('fs')
const os = require('os')
const path = require('path')
const webpack = require('webpack')
const nexe = require('nexe')
const webpackConfig = require('./webpack.config')
const fontFiles = require('./dist/src/fonts').fontFiles

/** To upgrade the Node.js version:
 *
 * When upgrading the Node.js version you'll need to make sure a pre-built version of the nexe-patched version of
 * node.js is available at PREBUILT_REMOTE_URL
 *
 * In order to do that, make the following changes to this file:
 * 1. Set BUILD_NODE_EXECUTABLE=true
 * 2. Change TARGET_NODE_VERSION to whatever node version you want
 * These changes will cause nexe to build a version of Node.js for the platform it's running on. Note that once
 * BUILD_NODE_EXECUTABLE is true, nexe will not build the actual Salto app correctly for platforms other than the
 * current one.
 *
 * Once you made these changes to the file, run 'yarn package'. This will build a nexe-patched version of Node.js.
 * Locate this Node.js binary at ~/.nexe/18.12.1/out/Release. Rename it as follows:
 *  - [linux/mac/windows]-[x64/arm64]-xx.yy.zz (where xx.yy.zz is the version of Node.js)
 * Upload the renamed binary to the S3 bucket referenced in PREBUILT_REMOTE_URL and make sure its ACL is public-read
 * Now repeat for all supported platforms
 * Once there is a Node.js binary for all supported platforms in the S3 bucket you can set BUILD_NODE_EXECUTABLE=false,
 * and the binaries you uploaded should be used automatically.
 * */

const BUILD_NODE_EXECUTABLE = false

const TARGET_FILE_BASENAME = 'salto'
const TARGET_DIR = 'pkg'
const TARGET_ARCH = BUILD_NODE_EXECUTABLE ? os.arch() : 'x64'
const TARGET_NODE_VERSION = '18.12.1'
const TARGET_PLATFORMS = {
  win: { ext: '.exe' },
  linux: {},
  mac: {},
} // alpine not included for now
const PREBUILT_REMOTE_URL = 'https://salto-cli-releases.s3.eu-central-1.amazonaws.com/build_artifacts/'

const resources = [
  ...fontFiles.values(),
  '../../node_modules/@salto-io/suitecloud-cli/src/metadata/*.json',
  '../../node_modules/@salto-io/suitecloud-cli/src/templates/**',
  '../../node_modules/@salto-io/rocksdb/**',
]

const BASE_NEXE_CONFIG = {
  loglevel: 'verbose',
  resources,
  ...(BUILD_NODE_EXECUTABLE ? { build: true, make: ['--jobs=4'] } : {} )
}

const nexeConfigs = () => Object.entries(TARGET_PLATFORMS)
  .map(([platform, platformOpts = {}]) => {
    const target = { platform, arch: TARGET_ARCH, version: TARGET_NODE_VERSION }
    return {
      output: `${path.join(TARGET_DIR, platform, TARGET_FILE_BASENAME)}${platformOpts.ext || ''}`,
      target,
      remote: PREBUILT_REMOTE_URL,
    }
  })

const handleError = err => {
  console.error(err.stack || err);
  if (err.details) {
    console.error(err.details);
  }
  process.exit(2)
}

const doWebpack = (config) => new Promise((resolve, reject) => {
  console.log('Running webpack')
  webpack(config, (err, stats) => {
    if (err) {
      handleError(err)
      reject()
    }

    if (stats.hasErrors()) {
      console.error(stats.toString())
      reject()
    }

    if (stats.hasWarnings()) {
      const statsObj = stats.toJson({ warnings: true })
      const warningsToPrint = statsObj.warnings.filter(
        warning => config.stats.warningsFilter.every(re => !re.test(warning))
      )
      if (warningsToPrint.length) {
        console.warn(stats.toString())
      }
    }

    resolve()
  })
})

const doNexe = (input) => new Promise((resolve, reject) => {
  const next = configs => {
    const [ config ] = configs
    if (!config) {
      resolve()
      return
    }

    console.log('Running nexe for platform %o', config.target)

    nexe.compile({
      ...BASE_NEXE_CONFIG,
      ...config,
      input,
    }, err => {
      if (err) {
        handleError(err)
        reject()
      }

      next(configs.slice(1))
    })
  }

  next(nexeConfigs())
})

;(async () => {
  await doWebpack(webpackConfig)
  const bundle = path.join(webpackConfig.output.path, webpackConfig.output.filename)
  await doNexe(bundle)
  console.log('Done!')
})().catch(handleError)
