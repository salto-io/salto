/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { logDecorator, requiresLogin } from '../../src/client'

const logging = logger('adapter-components/src/client/decorators')

class TestCls {
  a: string
  clientName: string

  constructor() {
    this.a = ''
    this.clientName = 'cli'
  }

  async ensureLoggedIn(): Promise<void> {
    if (this.a !== 'logged in') {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    this.a = 'logged in'
    logging.info('ensureLoggedIn done')
  }

  @requiresLogin()
  async doSomething(): Promise<string> {
    logging.info('doSomething started')
    await new Promise(resolve => setTimeout(resolve, 10))
    this.a = `${this.a}, did something`
    return this.a
  }

  @logDecorator()
  async doSomethingElse(): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 10))
    return this.a
  }

  @logDecorator(['str', 'arr[0].str'])
  async doSomethingWithDetails(arg: { str: string; num: number; arr: { str: string }[] }): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 10))
    return `${this.a} ${arg.str} ${arg.arr[0].str}`
  }
}

describe('client_decorators', () => {
  describe('logDecorator', () => {
    let log: jest.SpyInstance
    let inst: TestCls

    beforeAll(() => {
      log = jest.spyOn(logging, 'timeDebug')
      inst = new TestCls()
    })
    beforeEach(() => {
      log.mockClear()
    })

    it('should log', async () => {
      await inst.doSomethingElse()
      expect(logging.timeDebug).toHaveBeenCalledTimes(1)
      expect(logging.timeDebug).toHaveBeenCalledWith(expect.anything(), 'cli:client.doSomethingElse()')
    })

    it('should log with arguments', async () => {
      await inst.doSomethingWithDetails({ str: 'bla', num: 123, arr: [{ str: 'str' }, { str: 'STR' }] })
      expect(logging.timeDebug).toHaveBeenCalledTimes(1)
      expect(logging.timeDebug).toHaveBeenCalledWith(expect.anything(), 'cli:client.doSomethingWithDetails(bla, str)')
    })
  })

  describe('ensureLoggedIn', () => {
    let log: jest.SpyInstance
    let inst: TestCls

    beforeAll(() => {
      log = jest.spyOn(logging, 'info')
      inst = new TestCls()
    })
    beforeEach(() => {
      log.mockClear()
    })

    it('should call ensureLoggedIn before function when requiresLogin is used', async () => {
      await inst.doSomething()
      expect(inst.a).toEqual('logged in, did something')
    })
  })
})
