/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
