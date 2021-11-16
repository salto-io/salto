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

import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import setSuiteAppUrls from '../../src/service_url/suiteapp_elements_url'
import NetsuiteClient from '../../src/client/client'
import { NETSUITE } from '../../src/constants'

describe('setSuiteAppElementsUrl', () => {
  const client = {
    url: 'https://tstdrv2259448.app.netsuite.com',
  } as unknown as NetsuiteClient
  let elements: InstanceElement[]
  beforeAll(() => {
    elements = [
      new InstanceElement('A', new ObjectType({ elemID: new ElemID(NETSUITE, 'account'), annotations: { source: 'soap' } }), { internalId: '123' }),
      new InstanceElement('B', new ObjectType({ elemID: new ElemID(NETSUITE, 'subsidiary'), annotations: { source: 'soap' } }), { internalId: '124' }),
      new InstanceElement('C', new ObjectType({ elemID: new ElemID(NETSUITE, 'manufacturingCostTemplate'), annotations: { source: 'soap' } }), { internalId: '125' }),
      new InstanceElement('D', new ObjectType({ elemID: new ElemID(NETSUITE, 'inventoryItem'), annotations: { source: 'soap' } }), { internalId: '126' }),
      new InstanceElement('E', new ObjectType({ elemID: new ElemID(NETSUITE, 'assemblyItem'), annotations: { source: 'soap' } }), { internalId: '127' }),
    ]
  })

  it('should set the right url', async () => {
    await setSuiteAppUrls(elements, client)
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual('https://tstdrv2259448.app.netsuite.com/app/accounting/account/account.nl?id=123')
    expect(elements[1].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual('https://tstdrv2259448.app.netsuite.com/app/common/otherlists/subsidiarytype.nl?id=124')
    expect(elements[2].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual('https://tstdrv2259448.app.netsuite.com/app/accounting/manufacturing/mfgcosttemplate.nl?id=125')
    expect(elements[3].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual('https://tstdrv2259448.app.netsuite.com/app/common/item/item.nl?id=126')
    expect(elements[4].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual('https://tstdrv2259448.app.netsuite.com/app/common/item/item.nl?id=127')
  })

  it('should not set url if the type name is not in list', async () => {
    const unknownType = new InstanceElement('unknown', new ObjectType({ elemID: new ElemID(NETSUITE, 'bla'), annotations: { source: 'soap' } }), { internalId: '101' })
    await setSuiteAppUrls([unknownType], client)
    expect(unknownType.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })

  it('should not set url if the internalId is undefined', async () => {
    const noInternalId = new InstanceElement('noInternalId', new ObjectType({ elemID: new ElemID(NETSUITE, 'account'), annotations: { source: 'soap' } }))
    await setSuiteAppUrls([noInternalId], client)
    expect(noInternalId.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })
})
