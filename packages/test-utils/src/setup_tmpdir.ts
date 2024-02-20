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
import { promisify } from 'util'
import { mkdtemp as mkdtempCB, realpath as realpathCB, rmdir as rmdirCB } from 'fs'
import { tmpdir } from 'os'

const mkdtemp = promisify(mkdtempCB)
const rmdir = promisify(rmdirCB)
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
    await rmdir(dirName, { recursive: true })
  })
  return { name: () => dirName }
}
