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

import { ElementMergeManager, createMergeManager, Flushable } from '../../../src/workspace/nacl_files/elements_cache'
import { persistentMockCreateRemoteMap } from '../../utils'

const NAMESPACE = 'TEST_NAMESPACE'

describe('test cache manager', () => {
  let manager: ElementMergeManager
  let flushables: Flushable[]

  const createFlushable = (): Flushable => ({
    flush: jest.fn(),
    clear: jest.fn(),
  })

  beforeEach(async () => {
    flushables = [createFlushable(), createFlushable(), createFlushable()]
    manager = await createMergeManager(flushables, {}, persistentMockCreateRemoteMap(), NAMESPACE, true)
  })

  describe('On clear', () => {
    it('calls clear on each flushable', async () => {
      await manager.clear()
      await Promise.all(
        flushables.map(async flushable => {
          expect(flushable.clear).toHaveBeenCalled()
        }),
      )
    })
  })
  describe('On flush', () => {
    it('If flush was successful, doesnt clear on init', async () => {
      await manager.flush()
      await Promise.all(
        flushables.map(async flushable => {
          expect(flushable.clear).not.toHaveBeenCalled()
        }),
      )
    })

    it('If flush was unsuccessful, clears on init', async () => {
      const mapCreator = persistentMockCreateRemoteMap()
      const origManager = await createMergeManager(flushables, {}, mapCreator, NAMESPACE, true)
      flushables[1].flush = () => {
        throw new Error('Error within flush')
      }
      try {
        await origManager.flush()
        throw new Error('Flush should throw exception!')
      } catch {
        // Do nothing
      }
      const nextManager = await createMergeManager(flushables, {}, mapCreator, NAMESPACE, true)
      await nextManager.getHash('')
      await Promise.all(
        flushables.map(async flushable => {
          expect(flushable.clear).toHaveBeenCalled()
        }),
      )
    })
  })
})
