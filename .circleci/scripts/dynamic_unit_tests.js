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
const { writeFileSync, existsSync } = require('fs')
const path = require('path')

const hasTests = (location) => {
  return existsSync(`${location}/test`)
}

const getWorkspacesWithTests = () => {
  const output = execSync('yarn workspaces list --json -v', { encoding: 'utf8' })
  return JSON.parse(`[${output.split('\n').filter(Boolean).join(',')}]`).reduce((result, ws) => { 
    if (hasTests(ws.location))
      result.push(ws.name)
    return result
  }, [])
}

const main = () => {
  const workspacesToTest = getWorkspacesWithTests()
  console.log('Packages to test: ', workspacesToTest)
  const workspacesToTestFilePath = path.join(__dirname, '..', 'ut_packages_to_test.txt')
  writeFileSync(workspacesToTestFilePath, workspacesToTest.join('\n'))
}

main()
