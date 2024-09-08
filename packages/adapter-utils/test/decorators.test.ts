/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { logDuration } from '../src/decorators'

const logging = logger('adapter-utils/src/decorators')

class TestCls {
  a: number
  constructor() {
    this.a = 11
  }

  @logDuration('running sync')
  syncFunc(): string {
    return `ran sync ${this.a}`
  }

  @logDuration('running async')
  async asyncFunc(): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 10))
    return `ran async ${this.a}`
  }
}

describe('decorators', () => {
  describe('logDuration', () => {
    let log: jest.SpyInstance
    let inst: TestCls

    beforeAll(() => {
      log = jest.spyOn(logging, 'timeDebug')
      inst = new TestCls()
    })
    beforeEach(() => {
      log.mockClear()
    })
    it('should log the time it took to run sync functions', () => {
      inst.syncFunc()
      expect(logging.timeDebug).toHaveBeenCalledTimes(1)
      expect(logging.timeDebug).toHaveBeenCalledWith(expect.anything(), 'running sync')
    })

    it('should log the time it took to run async functions', async () => {
      await inst.asyncFunc()
      expect(logging.timeDebug).toHaveBeenCalledTimes(1)
      expect(logging.timeDebug).toHaveBeenCalledWith(expect.anything(), 'running async')
    })
  })
})
