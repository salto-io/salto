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
import { Workspace } from '@salto-io/workspace'
import { cleanWorkspace } from '../../src/core/clean'
import * as adapters from '../../src/core/adapters'
import { mockWorkspace } from '../common/workspace'

jest.mock('../../src/core/adapters', () => ({
  ...jest.requireActual<{}>('../../src/core/adapters'),
  getDefaultAdapterConfig: jest.fn(account => ({ account, aaa: 'aaa' })),
}))

describe('clean', () => {
  let workspace: Workspace

  beforeEach(async () => {
    workspace = mockWorkspace({ accounts: ['salesforce', 'netsuite'] })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should call workspace.clear with the relevant parameters and clear the credentials', async () => {
    await cleanWorkspace(workspace, {
      nacl: true,
      state: true,
      cache: true,
      staticResources: false,
      credentials: true,
      accountConfig: true,
    })
    expect(workspace.clear).toHaveBeenCalledWith({
      nacl: true,
      state: true,
      cache: true,
      staticResources: false,
      credentials: true,
    })
    expect(adapters.getDefaultAdapterConfig).toHaveBeenCalledWith('salesforce', 'salesforce')
    expect(adapters.getDefaultAdapterConfig).toHaveBeenCalledWith('netsuite', 'netsuite')
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
    await cleanWorkspace(workspace, {
      nacl: true,
      state: true,
      cache: true,
      staticResources: true,
      credentials: false,
      accountConfig: false,
    })
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
    await cleanWorkspace(workspace, {
      nacl: true,
      state: true,
      cache: true,
      staticResources: true,
      credentials: true,
      accountConfig: true,
    })
    expect(adapters.getDefaultAdapterConfig).toHaveBeenCalledWith('salesforce', 'salesforce')
    expect(adapters.getDefaultAdapterConfig).toHaveBeenCalledWith('netsuite', 'netsuite')
    expect(workspace.updateAccountConfig).not.toHaveBeenCalled()
    expect(workspace.flush).toHaveBeenCalled()
  })
})
