/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { promisify } from 'util'
import { mkdtemp as mkdtempCB, realpath as realpathCB, rm as rmCB } from 'fs'
import { tmpdir } from 'os'

const mkdtemp = promisify(mkdtempCB)
const rm = promisify(rmCB)
const realpath = promisify(realpathCB)

type TempDir = {
  name: () => string
}

export const setupTmpDir = (setupType: 'each' | 'all' = 'each'): TempDir => {
  const [setupFunc, teardownFunc] = setupType === 'all' ? [beforeAll, afterAll] : [beforeEach, afterEach]

  let dirName: string
  setupFunc(async () => {
    dirName = await mkdtemp(`${await realpath(tmpdir())}/`)
  })

  teardownFunc(async () => {
    await rm(dirName, { recursive: true })
  })
  return { name: () => dirName }
}
