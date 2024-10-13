/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import fs from 'fs'
import path from 'path'
import { setupTmpDir } from '@salto-io/test-utils'

export const setupTmpProject = (): ReturnType<typeof setupTmpDir> => {
  const tmpDir = setupTmpDir('all')
  beforeAll(async () => {
    await fs.promises.cp(path.join(__dirname, 'test_sfdx_project'), tmpDir.name(), { recursive: true })
  })
  return tmpDir
}
