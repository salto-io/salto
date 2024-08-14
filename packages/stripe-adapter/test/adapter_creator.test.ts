/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { InstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { adapter } from '../src/adapter_creator'
import { credentialsType } from '../src/auth'
import * as connection from '../src/client/connection'

describe('adapter creator', () => {
  let mockAxiosAdapter: MockAdapter
  beforeEach(() => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
    jest.clearAllMocks()
  })

  it('should validate credentials using createConnection', async () => {
    jest.spyOn(connection, 'createConnection')
    mockAxiosAdapter.onGet('/v1/products').replyOnce(200, {})
    expect(await adapter.validateCredentials(new InstanceElement('config', credentialsType, { token: 'aaa' }))).toEqual(
      { accountId: '' },
    )
    expect(connection.createConnection).toHaveBeenCalledTimes(1)
  })

  it('should throw UnauthorizedError when auth validation returns an unexpected HTTP code', async () => {
    jest.spyOn(connection, 'createConnection')
    mockAxiosAdapter.onGet('/v1/products').replyOnce(203)
    await expect(() =>
      adapter.validateCredentials(new InstanceElement('config', credentialsType, { token: 'aaa' })),
    ).rejects.toThrow(new clientUtils.UnauthorizedError('Unauthorized - update credentials and try again'))
    expect(connection.createConnection).toHaveBeenCalledTimes(1)
  })
})
