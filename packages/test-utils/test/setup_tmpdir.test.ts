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
import fs from 'fs'
import path from 'path'
import { setupTmpDir } from '../src/setup_tmpdir'

describe('setupTmpDir', () => {
  describe('when set before all', () => {
    const testDir = setupTmpDir('all')
    let testFileName: string
    it('should create a test dir', async () => {
      expect(testDir.name()).toBeDefined()
      const stat = await fs.promises.stat(testDir.name())
      expect(stat.isDirectory()).toBeTruthy()
      testFileName = path.join(testDir.name(), 'bla.txt')
      await fs.promises.writeFile(testFileName, 'data')
    })
    it('should not clear directory between tests', async () => {
      await expect(fs.promises.stat(testFileName)).resolves.not.toThrow()
      const data = await fs.promises.readFile(testFileName, { encoding: 'utf8' })
      expect(data).toEqual('data')
    })
  })
  describe('when set to before each', () => {
    const testDir = setupTmpDir()
    let testFileName: string
    it('should create a test dir', async () => {
      expect(testDir.name()).toBeDefined()
      const stat = await fs.promises.stat(testDir.name())
      expect(stat.isDirectory()).toBeTruthy()
      testFileName = path.join(testDir.name(), 'bla.txt')
      await fs.promises.writeFile(testFileName, 'data')
    })
    it('should clear directory between tests', async () => {
      // Dir should exist
      expect(testDir.name()).toBeDefined()
      const stat = await fs.promises.stat(testDir.name())
      expect(stat.isDirectory()).toBeTruthy()
      // File from previous test should not
      await expect(fs.promises.stat(testFileName)).rejects.toThrow()
    })
  })
})
