/*
*                      Copyright 2021 Salto Labs Ltd.
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
  getDefaultAdapterConfig: jest.fn(service => ({ service, aaa: 'aaa' })),
}))

describe('clean', () => {
  let workspace: Workspace

  beforeEach(async () => {
    workspace = mockWorkspace({ services: ['salesforce', 'netsuite'] })
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
      serviceConfig: true,
    })
    expect(workspace.clear).toHaveBeenCalledWith({
      nacl: true,
      state: true,
      cache: true,
      staticResources: false,
      credentials: true,
    })
    expect(adapters.getDefaultAdapterConfig).toHaveBeenCalledWith('salesforce')
    expect(adapters.getDefaultAdapterConfig).toHaveBeenCalledWith('netsuite')
    expect(workspace.updateServiceConfig).toHaveBeenCalledWith('salesforce', { service: 'salesforce', aaa: 'aaa' })
    expect(workspace.updateServiceConfig).toHaveBeenCalledWith('netsuite', { service: 'netsuite', aaa: 'aaa' })
    expect(workspace.flush).toHaveBeenCalled()
  })

  it('should not clear the service config if not specified', async () => {
    await cleanWorkspace(workspace, {
      nacl: true,
      state: true,
      cache: true,
      staticResources: true,
      credentials: false,
      serviceConfig: false,
    })
    expect(workspace.clear).toHaveBeenCalledWith({
      nacl: true,
      state: true,
      cache: true,
      staticResources: true,
      credentials: false,
    })
    expect(adapters.getDefaultAdapterConfig).not.toHaveBeenCalled()
    expect(workspace.updateServiceConfig).not.toHaveBeenCalled()
    expect(workspace.flush).toHaveBeenCalled()
  })

  it('should finish even if some serviec configs cannot be restored', async () => {
    jest.spyOn(adapters, 'getDefaultAdapterConfig').mockImplementationOnce(() => undefined).mockImplementationOnce(() => undefined)
    await cleanWorkspace(workspace, {
      nacl: true,
      state: true,
      cache: true,
      staticResources: true,
      credentials: true,
      serviceConfig: true,
    })
    expect(adapters.getDefaultAdapterConfig).toHaveBeenCalledWith('salesforce')
    expect(adapters.getDefaultAdapterConfig).toHaveBeenCalledWith('netsuite')
    expect(workspace.updateServiceConfig).not.toHaveBeenCalled()
    expect(workspace.flush).toHaveBeenCalled()
  })
})
