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
import { CORE_ANNOTATIONS, InstanceElement } from '@salto-io/adapter-api'
import { crmcustomfieldType } from '../../src/autogen/types/standard_types/crmcustomfield'
import NetsuiteClient from '../../src/client/client'
import setServiceUrl from '../../src/service_url/custom_field'
import { entitycustomfieldType } from '../../src/autogen/types/standard_types/entitycustomfield'
import { itemcustomfieldType } from '../../src/autogen/types/standard_types/itemcustomfield'
import { itemnumbercustomfieldType } from '../../src/autogen/types/standard_types/itemnumbercustomfield'
import { itemoptioncustomfieldType } from '../../src/autogen/types/standard_types/itemoptioncustomfield'
import { othercustomfieldType } from '../../src/autogen/types/standard_types/othercustomfield'
import { transactionbodycustomfieldType } from '../../src/autogen/types/standard_types/transactionbodycustomfield'
import { transactioncolumncustomfieldType } from '../../src/autogen/types/standard_types/transactioncolumncustomfield'


describe('setCustomFieldsUrls', () => {
  const runSuiteQlMock = jest.fn()
  const client = {
    runSuiteQL: runSuiteQlMock,
    url: 'https://accountid.app.netsuite.com',
  } as unknown as NetsuiteClient
  const crmcustomfield = crmcustomfieldType().type
  const entitycustomfield = entitycustomfieldType().type
  const itemcustomfield = itemcustomfieldType().type
  const itemnumbercustomfield = itemnumbercustomfieldType().type
  const itemoptioncustomfield = itemoptioncustomfieldType().type
  const othercustomfield = othercustomfieldType().type
  const transactionbodycustomfield = transactionbodycustomfieldType().type
  const transactioncolumncustomfield = transactioncolumncustomfieldType().type

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
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://accountid.app.netsuite.com/app/common/custom/eventcustfield.nl?id=1')
    expect(elements[1].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://accountid.app.netsuite.com/app/common/custom/entitycustfield.nl?id=2')
    expect(elements[2].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://accountid.app.netsuite.com/app/common/custom/itemcustfield.nl?id=3')
    expect(elements[3].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://accountid.app.netsuite.com/app/common/custom/itemnumbercustfield.nl?id=4')
    expect(elements[4].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://accountid.app.netsuite.com/app/common/custom/itemoption.nl?id=5')
    expect(elements[5].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://accountid.app.netsuite.com/app/common/custom/othercustfield.nl?id=6')
    expect(elements[6].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://accountid.app.netsuite.com/app/common/custom/bodycustfield.nl?id=7')
    expect(elements[7].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://accountid.app.netsuite.com/app/common/custom/columncustfield.nl?id=8')
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
