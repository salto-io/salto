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
      new InstanceElement(
        'A',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'account'), annotations: { source: 'soap' } }),
        { internalId: '123' },
      ),
      new InstanceElement(
        'B',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'subsidiary'), annotations: { source: 'soap' } }),
        { internalId: '124' },
      ),
      new InstanceElement(
        'C',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'department'), annotations: { source: 'soap' } }),
        { internalId: '125' },
      ),
      new InstanceElement(
        'D',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'classification'), annotations: { source: 'soap' } }),
        { internalId: '126' },
      ),
      new InstanceElement(
        'E',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'location'), annotations: { source: 'soap' } }),
        { internalId: '127' },
      ),
      new InstanceElement(
        'F',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'currency'), annotations: { source: 'soap' } }),
        { internalId: '128' },
      ),
      new InstanceElement(
        'G',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'customer'), annotations: { source: 'soap' } }),
        { internalId: '129' },
      ),
      new InstanceElement(
        'H',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'accountingPeriod'), annotations: { source: 'soap' } }),
        { internalId: '130' },
      ),
      new InstanceElement(
        'I',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'employee'), annotations: { source: 'soap' } }),
        { internalId: '131' },
      ),
      new InstanceElement(
        'J',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'job'), annotations: { source: 'soap' } }),
        { internalId: '132' },
      ),
      new InstanceElement(
        'K',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'manufacturingCostTemplate'), annotations: { source: 'soap' } }),
        { internalId: '133' },
      ),
      new InstanceElement(
        'L',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'partner'), annotations: { source: 'soap' } }),
        { internalId: '134' },
      ),
      new InstanceElement(
        'M',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'solution'), annotations: { source: 'soap' } }),
        { internalId: '135' },
      ),
      new InstanceElement(
        'N',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'inventoryItem'), annotations: { source: 'soap' } }),
        { internalId: '136' },
      ),
      new InstanceElement(
        'O',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'assemblyItem'), annotations: { source: 'soap' } }),
        { internalId: '137' },
      ),
    ]
  })

  it('should set the right url', async () => {
    await setSuiteAppUrls(elements, client)
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
      'https://tstdrv2259448.app.netsuite.com/app/accounting/account/account.nl?id=123',
    )
    expect(elements[1].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
      'https://tstdrv2259448.app.netsuite.com/app/common/otherlists/subsidiarytype.nl?id=124',
    )
    expect(elements[2].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
      'https://tstdrv2259448.app.netsuite.com/app/common/otherlists/departmenttype.nl?id=125',
    )
    expect(elements[3].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
      'https://tstdrv2259448.app.netsuite.com/app/common/otherlists/classtype.nl?id=126',
    )
    expect(elements[4].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
      'https://tstdrv2259448.app.netsuite.com/app/common/otherlists/locationtype.nl?id=127',
    )
    expect(elements[5].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
      'https://tstdrv2259448.app.netsuite.com/app/common/multicurrency/currency.nl?e=T&id=128',
    )
    expect(elements[6].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
      'https://tstdrv2259448.app.netsuite.com/app/common/entity/custjob.nl?id=129',
    )
    expect(elements[7].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
      'https://tstdrv2259448.app.netsuite.com/app/setup/period/fiscalperiod.nl?e=T&id=130',
    )
    expect(elements[8].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
      'https://tstdrv2259448.app.netsuite.com/app/common/entity/employee.nl?id=131',
    )
    expect(elements[9].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
      'https://tstdrv2259448.app.netsuite.com/app/accounting/project/project.nl?id=132',
    )
    expect(elements[10].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
      'https://tstdrv2259448.app.netsuite.com/app/accounting/manufacturing/mfgcosttemplate.nl?id=133',
    )
    expect(elements[11].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
      'https://tstdrv2259448.app.netsuite.com/app/common/entity/partner.nl?id=134',
    )
    expect(elements[12].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
      'https://tstdrv2259448.app.netsuite.com/app/crm/support/kb/solution.nl?id=135',
    )
    expect(elements[13].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
      'https://tstdrv2259448.app.netsuite.com/app/common/item/item.nl?id=136',
    )
    expect(elements[14].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
      'https://tstdrv2259448.app.netsuite.com/app/common/item/item.nl?id=137',
    )
  })

  it('should not set url if the type name is not in list', async () => {
    const unknownType = new InstanceElement(
      'unknown',
      new ObjectType({ elemID: new ElemID(NETSUITE, 'bla'), annotations: { source: 'soap' } }),
      { internalId: '101' },
    )
    await setSuiteAppUrls([unknownType], client)
    expect(unknownType.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })

  it('should not set url if the internalId is undefined', async () => {
    const noInternalId = new InstanceElement(
      'noInternalId',
      new ObjectType({ elemID: new ElemID(NETSUITE, 'account'), annotations: { source: 'soap' } }),
    )
    await setSuiteAppUrls([noInternalId], client)
    expect(noInternalId.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })
})
