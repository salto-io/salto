#!/usr/bin/env node

const fs = require('fs')
const fsp = fs.promises

const COVERAGE_INPUT_FILE = './coverage/coverage-summary.json'
const COVERAGE_THRESHOLD_FILE = './coverage_thresholds.json'

const main = async () => {
  if (!fs.existsSync(COVERAGE_INPUT_FILE)) {
    console.log(`Coverage file ${COVERAGE_INPUT_FILE} not found, exiting`)
    return
  }

  const actual = JSON.parse(await fsp.readFile(COVERAGE_INPUT_FILE, { encoding: 'utf8' })).total
  if (!actual) {
    throw new Error(`Could not find coverage in ${COVERAGE_INPUT_FILE}`)
  }

  const global = Object.assign({},
    ...Object.keys(actual).map(k => ({ [k]: actual[k].pct }))
  )

  const thresholds = fs.existsSync(COVERAGE_THRESHOLD_FILE)
    ? JSON.parse(await fsp.readFile(COVERAGE_THRESHOLD_FILE, { encoding: 'utf8' }))
    : {}

  const updatedTresholds = Object.assign(thresholds, { global })

  await fsp.writeFile(COVERAGE_THRESHOLD_FILE, JSON.stringify(updatedTresholds, null, 2))
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

