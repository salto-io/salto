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
const { writeFileSync, existsSync, readdirSync } = require('fs')
const path = require('path')

const getWorkspacesInfo = () => {
  const output = execSync('yarn workspaces list --json -v', { encoding: 'utf8' })
  const transformToObject = (array) => {
    return array.reduce((acc,item) => {
      const { name, ...rest } = item
      acc[name] = rest
      return acc
    }, {})
  }
  return transformToObject(JSON.parse(`[${output.split('\n').filter(Boolean).join(',')}]`))
}

const hasE2eTests = packagePath => {
  const e2eDir = path.join(__dirname, '..', '..', packagePath, 'e2e_test')
  const e2eDirExists = existsSync(e2eDir)
  const e2eDirHasTestFiles = e2eDirExists && readdirSync(e2eDir).some(file => file.endsWith('.test.ts'))
  console.log('e2eDir:', e2eDir, 'exists:', e2eDirExists, 'hasTestFiles:', e2eDirHasTestFiles)
  return e2eDirHasTestFiles
}

const main = () => {
  const workspaceInfo = getWorkspacesInfo()
  const e2ePackagesToTest = Object.entries(workspaceInfo).filter(([_name, details]) => hasE2eTests(details.location)).map(([name, _details]) => name)
  const packagesWithE2eTestsFilePath = path.join(__dirname, '..', 'e2e_packages_to_test.txt')
  writeFileSync(packagesWithE2eTestsFilePath, e2ePackagesToTest.join('\n'))
}

main()
