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
import { crmcustomfield } from '../../src/types/custom_types/crmcustomfield'
import NetsuiteClient from '../../src/client/client'
import setServiceUrl from '../../src/service_url/custom_field'
import { entitycustomfield } from '../../src/types/custom_types/entitycustomfield'
import { itemcustomfield } from '../../src/types/custom_types/itemcustomfield'
import { itemnumbercustomfield } from '../../src/types/custom_types/itemnumbercustomfield'
import { itemoptioncustomfield } from '../../src/types/custom_types/itemoptioncustomfield'
import { othercustomfield } from '../../src/types/custom_types/othercustomfield'
import { transactionbodycustomfield } from '../../src/types/custom_types/transactionbodycustomfield'
import { transactioncolumncustomfield } from '../../src/types/custom_types/transactioncolumncustomfield'


describe('setCustomFieldsUrls', () => {
  const runSuiteQlMock = jest.fn()
  const client = {
    runSuiteQL: runSuiteQlMock,
    url: 'https://tstdrv2259448.app.netsuite.com',
  } as unknown as NetsuiteClient

  let elements: InstanceElement[]

  beforeEach(() => {
    jest.resetAllMocks()
    runSuiteQlMock.mockResolvedValue([
      { scriptid: 'CRMCUSTOMFIELDID', id: '1' },
      { scriptid: 'ENTITYCUSTOMFIELDID', id: '2' },
      { scriptid: 'ITEMCUSTOMFIELDID', id: '3' },
      { scriptid: 'ITEMNUMBERCUSTOMFIELDID', id: '4' },
      { scriptid: 'ITEMOPTIONCUSTOMFIELDID', id: '5' },
      { scriptid: 'OTHERCUSTOMFIELDID', id: '6' },
      { scriptid: 'TRANSACTIONBODYCUSTOMFIELDID', id: '7' },
      { scriptid: 'TRANSACTIONCOLUMNCUSTOMFIELDID', id: '8' },
    ])
    elements = [
      new InstanceElement('A', crmcustomfield, { scriptid: 'crmcustomfieldid' }),
      new InstanceElement('B', entitycustomfield, { scriptid: 'entitycustomfieldid' }),
      new InstanceElement('C', itemcustomfield, { scriptid: 'itemcustomfieldid' }),
      new InstanceElement('D', itemnumbercustomfield, { scriptid: 'itemnumbercustomfieldid' }),
      new InstanceElement('E', itemoptioncustomfield, { scriptid: 'itemoptioncustomfieldid' }),
      new InstanceElement('F', othercustomfield, { scriptid: 'othercustomfieldid' }),
      new InstanceElement('G', transactionbodycustomfield, { scriptid: 'transactionbodycustomfieldid' }),
      new InstanceElement('H', transactioncolumncustomfield, { scriptid: 'transactioncolumncustomfieldid' }),
    ]
  })

  it('should set the right url', async () => {
    await setServiceUrl(elements, client)
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://tstdrv2259448.app.netsuite.com/app/common/custom/eventcustfield.nl?id=1')
    expect(elements[1].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://tstdrv2259448.app.netsuite.com/app/common/custom/entitycustfield.nl?id=2')
    expect(elements[2].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://tstdrv2259448.app.netsuite.com/app/common/custom/itemcustfield.nl?id=3')
    expect(elements[3].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://tstdrv2259448.app.netsuite.com/app/common/custom/itemnumbercustfield.nl?id=4')
    expect(elements[4].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://tstdrv2259448.app.netsuite.com/app/common/custom/itemoption.nl?id=5')
    expect(elements[5].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://tstdrv2259448.app.netsuite.com/app/common/custom/othercustfield.nl?id=6')
    expect(elements[6].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://tstdrv2259448.app.netsuite.com/app/common/custom/bodycustfield.nl?id=7')
    expect(elements[7].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://tstdrv2259448.app.netsuite.com/app/common/custom/columncustfield.nl?id=8')
  })

  it('should not set url if not found internal id', async () => {
    const notFoundElement = new InstanceElement('A2', crmcustomfield, { scriptid: 'someScriptID2' })
    await setServiceUrl([notFoundElement], client)
    expect(notFoundElement.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })

  it('invalid results should throw an error', async () => {
    runSuiteQlMock.mockResolvedValue([{ scriptid: 'someScriptID' }])
    await expect(setServiceUrl(elements, client)).rejects.toThrow()
  })
})
