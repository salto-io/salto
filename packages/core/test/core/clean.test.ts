/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Workspace } from '@salto-io/workspace'
import { Adapter } from '@salto-io/adapter-api'
import { cleanWorkspace } from '../../src/core/clean'
import * as adapters from '../../src/core/adapters'
import { mockWorkspace } from '../common/workspace'
import { createMockAdapter } from '../common/helpers'

jest.mock('../../src/core/adapters', () => ({
  ...jest.requireActual<{}>('../../src/core/adapters'),
  getDefaultAdapterConfig: jest.fn(account => ({ account: account.adapterName, aaa: 'aaa' })),
}))

describe('clean', () => {
  let workspace: Workspace
  const mockAdapterCreator: Record<string, Adapter> = {}
  const sfMockAdapter = createMockAdapter('salesforce')
  mockAdapterCreator.salesforce = sfMockAdapter

  beforeEach(async () => {
    workspace = mockWorkspace({ accounts: ['salesforce', 'netsuite'] })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should call workspace.clear with the relevant parameters and clear the credentials', async () => {
    await cleanWorkspace(
      workspace,
      {
        nacl: true,
        state: true,
        cache: true,
        staticResources: false,
        credentials: true,
        accountConfig: true,
      },
      mockAdapterCreator,
    )
    expect(workspace.clear).toHaveBeenCalledWith({
      nacl: true,
      state: true,
      cache: true,
      staticResources: false,
      credentials: true,
    })
    expect(adapters.getDefaultAdapterConfig).toHaveBeenCalledWith({
      adapterName: 'salesforce',
      accountName: 'salesforce',
      adapterCreators: mockAdapterCreator,
    })
    expect(adapters.getDefaultAdapterConfig).toHaveBeenCalledWith({
      adapterName: 'netsuite',
      accountName: 'netsuite',
      adapterCreators: mockAdapterCreator,
    })
    expect(workspace.updateAccountConfig).toHaveBeenCalledWith(
      'salesforce',
      { account: 'salesforce', aaa: 'aaa' },
      'salesforce',
    )
    expect(workspace.updateAccountConfig).toHaveBeenCalledWith(
      'netsuite',
      { account: 'netsuite', aaa: 'aaa' },
      'netsuite',
    )
    expect(workspace.flush).toHaveBeenCalled()
  })

  it('should not clear the account config if not specified', async () => {
    await cleanWorkspace(
      workspace,
      {
        nacl: true,
        state: true,
        cache: true,
        staticResources: true,
        credentials: false,
        accountConfig: false,
      },
      mockAdapterCreator,
    )
    expect(workspace.clear).toHaveBeenCalledWith({
      nacl: true,
      state: true,
      cache: true,
      staticResources: true,
      credentials: false,
    })
    expect(adapters.getDefaultAdapterConfig).not.toHaveBeenCalled()
    expect(workspace.updateAccountConfig).not.toHaveBeenCalled()
    expect(workspace.flush).toHaveBeenCalled()
  })

  it('should finish even if some account configs cannot be restored', async () => {
    jest
      .spyOn(adapters, 'getDefaultAdapterConfig')
      .mockImplementationOnce(async () => undefined)
      .mockImplementationOnce(async () => undefined)
    await cleanWorkspace(
      workspace,
      {
        nacl: true,
        state: true,
        cache: true,
        staticResources: true,
        credentials: true,
        accountConfig: true,
      },
      mockAdapterCreator,
    )
    expect(adapters.getDefaultAdapterConfig).toHaveBeenCalledWith({
      adapterName: 'salesforce',
      accountName: 'salesforce',
      adapterCreators: mockAdapterCreator,
    })
    expect(adapters.getDefaultAdapterConfig).toHaveBeenCalledWith({
      adapterName: 'netsuite',
      accountName: 'netsuite',
      adapterCreators: mockAdapterCreator,
    })
    expect(workspace.updateAccountConfig).not.toHaveBeenCalled()
    expect(workspace.flush).toHaveBeenCalled()
  })
})
