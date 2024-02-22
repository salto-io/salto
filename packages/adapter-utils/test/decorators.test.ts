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
      log = jest.spyOn(logging, 'time')
      inst = new TestCls()
    })
    beforeEach(() => {
      log.mockClear()
    })
    it('should log the time it took to run sync functions', () => {
      inst.syncFunc()
      expect(logging.time).toHaveBeenCalledTimes(1)
      expect(logging.time).toHaveBeenCalledWith(expect.anything(), 'running sync')
    })

    it('should log the time it took to run async functions', async () => {
      await inst.asyncFunc()
      expect(logging.time).toHaveBeenCalledTimes(1)
      expect(logging.time).toHaveBeenCalledWith(expect.anything(), 'running async')
    })
  })
})
