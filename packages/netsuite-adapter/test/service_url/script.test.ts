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
import { CORE_ANNOTATIONS, InstanceElement } from '@salto-io/adapter-api'
import { restlet } from '../../src/autogen/types/custom_types/restlet'
import NetsuiteClient from '../../src/client/client'
import setServiceUrl from '../../src/service_url/script'
import { emailcaptureplugin } from '../../src/autogen/types/custom_types/emailcaptureplugin'
import { plugintype } from '../../src/autogen/types/custom_types/plugintype'


describe('setScriptsUrls', () => {
  const runSuiteQlMock = jest.fn()
  const client = {
    runSuiteQL: runSuiteQlMock,
    url: 'https://accountid.app.netsuite.com',
  } as unknown as NetsuiteClient

  let elements: InstanceElement[]

  beforeEach(() => {
    jest.resetAllMocks()
    runSuiteQlMock.mockResolvedValue([
      { scriptid: 'someScriptID', id: '1' },
      { scriptid: 'somePluginID', id: '2' },
      { scriptid: 'somePluginTypeID', id: '3' },
    ])
    elements = [
      new InstanceElement('A', restlet, { scriptid: 'someScriptID' }),
      new InstanceElement('B', emailcaptureplugin, { scriptid: 'somePluginID' }),
      new InstanceElement('C', plugintype, { scriptid: 'somePluginTypeID' }),

    ]
  })

  it('should set the right url', async () => {
    await setServiceUrl(elements, client)
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://accountid.app.netsuite.com/app/common/scripting/script.nl?id=1')
    expect(elements[1].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://accountid.app.netsuite.com/app/common/scripting/plugin.nl?id=2')
    expect(elements[2].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://accountid.app.netsuite.com/app/common/scripting/plugintype.nl?scripttype=PLUGINTYPE&id=3')
  })

  it('should not set url if not found internal id', async () => {
    const notFoundElement = new InstanceElement('A2', restlet, { scriptid: 'someScriptID2' })
    await setServiceUrl([notFoundElement], client)
    expect(notFoundElement.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })

  it('invalid results should throw an error', async () => {
    runSuiteQlMock.mockResolvedValue([{ scriptid: 'someScriptID' }])
    await expect(setServiceUrl(elements, client)).rejects.toThrow()
  })

  it('query failure should throw an error', async () => {
    runSuiteQlMock.mockResolvedValue(undefined)
    await expect(setServiceUrl(elements, client)).rejects.toThrow()
  })
})
