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

// List of plugins to check and import
const plugins = ['@yarnpkg/plugin-workspace-tools', '@yarnpkg/plugin-interactive-tools']

// Function to check if a plugin is installed
function isPluginInstalled(plugin) {
  try {
    const result = execSync('yarn plugin runtime --json').toString()
    const installedPlugins = result
      .trim()
      .split('\n')
      .map(line => JSON.parse(line).name)
    return installedPlugins.includes(plugin)
  } catch (error) {
    console.error('Error checking installed plugins:', error)
    return false
  }
}

// Import plugins if they are not already installed
try {
  plugins.forEach(plugin => {
    if (!isPluginInstalled(plugin)) {
      console.log(`Importing Yarn plugin: ${plugin}`)
      execSync(`yarn plugin import ${plugin}`, { stdio: 'inherit' })
    } else {
      console.log(`Yarn plugin already installed: ${plugin}`)
    }
  })
  console.log('Yarn plugins import completed')
} catch (error) {
  console.error('Failed to import Yarn plugins:', error)
  process.exit(1)
}
