/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElementMergeManager, createMergeManager, Flushable } from '../../../src/workspace/nacl_files/elements_cache'
import { inMemRemoteMapCreator } from '../../../src/workspace/remote_map'

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
    manager = await createMergeManager(flushables, {}, inMemRemoteMapCreator(), NAMESPACE, true)
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
      const mapCreator = inMemRemoteMapCreator()
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
