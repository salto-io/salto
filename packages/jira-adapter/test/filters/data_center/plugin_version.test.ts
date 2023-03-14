/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../utils'
import pluginVersionFilter, { PLUGIN_VERSION_NUMBER } from '../../../src/filters/data_center/plugin_version'

const changeVersion = (version: string, addition: number): string => {
  const versionParts = version.split('.')
  const lastPart = parseInt(versionParts[versionParts.length - 1], 10)
  versionParts[versionParts.length - 1] = (lastPart + addition).toString()
  return versionParts.join('.')
}

describe('plugin_version', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let mockConnection: MockInterface<clientUtils.APIConnection>

  beforeEach(async () => {
    const { client, connection } = mockClient(true)
    mockConnection = connection
    filter = pluginVersionFilter(getFilterParams({
      client,
    })) as filterUtils.FilterWith<'onFetch'>
  })
  it('should not raise a warning if plugin version is the same', async () => {
    mockConnection.get.mockResolvedValueOnce({
      status: 200,
      data: {
        version: PLUGIN_VERSION_NUMBER,
      },
    })
    const errors = await filter.onFetch([])
    expect(errors).toEqual(undefined)
  })
  it('should raise a warning if plugin version is older', async () => {
    mockConnection.get.mockResolvedValueOnce({
      status: 200,
      data: {
        version: changeVersion(PLUGIN_VERSION_NUMBER, -1),
      },
    })
    const errors = await filter.onFetch([])
    expect(errors).toEqual({
      errors: [{
        message: `Your Jira instance is running an old version ${changeVersion(PLUGIN_VERSION_NUMBER, -1)} of Salto Configuration Manager for Jira Data Center. Please update the app to the latest version from https://marketplace.atlassian.com/apps/1225356/salto-configuration-manager-for-jira.`,
        severity: 'Warning',
      }],
    })
  })
  it('should raise an info if plugin version is newer', async () => {
    const newerVersion = changeVersion(PLUGIN_VERSION_NUMBER, 1)
    mockConnection.get.mockResolvedValueOnce({
      status: 200,
      data: {
        version: newerVersion,
      },
    })
    const errors = await filter.onFetch([])
    expect(errors).toEqual({
      errors: [{
        message: 'The Salto for Jira DC addon version number is higher than expected. You may be running an outdated Salto CLI; please update it to the latest version from https://github.com/salto-io/salto/releases',
        severity: 'Info',
      }],
    })
  })
  it('should raise a warning if server answer is not in the correct format', async () => {
    mockConnection.get.mockResolvedValueOnce({
      status: 200,
      data: {
        notVersion: 'not a valid version',
      },
    })
    const errors = await filter.onFetch([])
    expect(errors).toEqual({
      errors: [{
        message: 'Could not verify version number for Salto for Jira DC addon. Please make sure you are using the latest version of Salto Configuration Manager for Jira Data Center. You can download it from the Jira Marketplace: https://marketplace.atlassian.com/apps/1225356/salto-configuration-manager-for-jira?tab=overview&hosting=datacenter',
        severity: 'Warning',
      }],
    })
  })
})
