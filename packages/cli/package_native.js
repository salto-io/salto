#!/usr/bin/env node

/*
*                      Copyright 2020 Salto Labs Ltd.
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
const path = require('path')
const webpack = require('webpack')
const nexe = require('nexe')
const webpackConfig = require('./webpack.config')
const fontFiles = require('./dist/src/fonts').fontFiles

const TARGET_FILE_BASENAME = 'salto'
const TARGET_DIR = 'pkg'
const TARGET_ARCH = 'x64'
const TARGET_NODE_VERSION = '12.9.1'
const TARGET_PLATFORMS = {
  win: { ext: '.exe' },
  linux: {},
  mac: {},
} // alpine not included for now

const resources = [
  ...fontFiles.values(),
  path.join(__dirname, '..', 'salto', 'dist', 'hcl.wasm')
]

const BASE_NEXE_CONFIG = {
  loglevel: 'verbose',
  resources,
}

const nexeConfigs = () => Object.entries(TARGET_PLATFORMS)
  .map(([platform, platformOpts = {}]) => ({
    output: `${path.join(TARGET_DIR, platform, TARGET_FILE_BASENAME)}${platformOpts.ext || ''}`,
    target: { platform, arch: TARGET_ARCH, version: TARGET_NODE_VERSION },
  }))

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

