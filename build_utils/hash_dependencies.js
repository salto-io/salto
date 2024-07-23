#!/usr/bin/env node
/*
 *                      Copyright 2024 Salto Labs Ltd.
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

const { execSync } = require('child_process')
const fs = require('fs')
const tmp = require('tmp')
const yargs = require('yargs/yargs')

const main = () => {
  const argv = yargs(process.argv)
    .option('package_name', {
      alias: 'p',
      type: 'string',
      description: 'Name of the package (omit to hash all monorepo)',
      demandOption: false,
    })
    .option('dependencies', {
      alias: 'd',
      type: 'boolean',
      description: 'Show the dependencies for package_name',
      demandOption: false,
    })
    .option('files', {
      alias: 'f',
      type: 'boolean',
      description: 'Show all the files that package_name depends on',
      demandOption: false,
    })
    .help().argv

  const currentPackage = argv.package_name
  tmp.setGracefulCleanup()
  const tempFile = tmp.fileSync()

  if (currentPackage) {
    const dependenciesGraph = JSON.parse(
      `[${execSync('yarn workspaces list --json -v').toString().trim().split('\n').join(',')}]`,
    )
    const { workspaceDependencies } = dependenciesGraph.find(ws => ws.name === currentPackage)
    if (argv.dependencies) {
      console.log(workspaceDependencies)
    }
    workspaceDependencies.forEach(ws => {
      fs.appendFileSync(tempFile.name, execSync(`find "${ws}" -type f -name "*.ts"`).toString().trim() + '\n')
    })
  } else {
    if (argv.dependencies) {
      const allPackages = execSync("yarn workspaces list --json | jq '.name'").toString().trim()
      console.log(allPackages)
    }
    fs.appendFileSync(tempFile.name, execSync(`find packages -type f -name "*.ts"`).toString().trim() + '\n')
  }

  if (argv.files) {
    console.log(fs.readFileSync(tempFile.name, { encoding: 'utf8' }))
  }

  console.log(execSync(`xargs shasum < ${tempFile.name} | shasum`).toString().split(' ')[0])
}

main()
