#!/usr/bin/env node
const path = require('path')
const webpack = require('webpack')
const nexe = require('nexe')
const webpackConfig = require('./webpack.config')
const fontFiles = require('./dist/src/fonts').fontFiles

const TARGET_FILE_BASENAME = 'salto'
const TARGET_DIR = 'pkg'
const TARGET_ARCH = 'x64'
const TARGET_NODE_VERSION = '12.9.1'

const resources = [
  ...fontFiles.values(),
  path.join(__dirname, '..', 'salto', 'dist', 'hcl.wasm'),
]

const { platform } = process
const isWindows = platform === 'win32'

const platformDir = {
  win32: 'windows',
  darwin: 'osx',
  linux: 'linux',
}

const BASE_NEXE_CONFIG = {
  output: [
    path.join(TARGET_DIR, platformDir[platform], TARGET_FILE_BASENAME),
    isWindows ? '.exe' : '',
  ].join(''),
  target: { platform, arch: TARGET_ARCH, version: TARGET_NODE_VERSION },
  loglevel: 'verbose',
  flags: [
    '--max-old-space-size=8192',
  ],
  resources,
}

console.dir(BASE_NEXE_CONFIG)

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
  nexe.compile({
    ...BASE_NEXE_CONFIG,
    input,
  }, err => {
    if (err) {
      handleError(err)
      reject()
    } else {
      resolve()
    }
  })
})

;(async () => {
  await doWebpack(webpackConfig)
  const bundle = path.join(webpackConfig.output.path, webpackConfig.output.filename)
  await doNexe(bundle)
  console.log('Done!')
})().catch(handleError)
