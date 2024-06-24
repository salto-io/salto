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
import { INTERNAL_ID } from '../../src/constants'

describe('setCustomFieldsUrls', () => {
  const client = {
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

  it('should set the right url', async () => {
    const elements = [
      new InstanceElement('A', crmcustomfield, { scriptid: 'crmcustomfieldid', [INTERNAL_ID]: '1' }),
      new InstanceElement('B', entitycustomfield, { scriptid: 'entitycustomfieldid', [INTERNAL_ID]: '2' }),
      new InstanceElement('C', itemcustomfield, { scriptid: 'itemcustomfieldid', [INTERNAL_ID]: '3' }),
      new InstanceElement('D', itemnumbercustomfield, { scriptid: 'itemnumbercustomfieldid', [INTERNAL_ID]: '4' }),
      new InstanceElement('E', itemoptioncustomfield, { scriptid: 'itemoptioncustomfieldid', [INTERNAL_ID]: '5' }),
      new InstanceElement('F', othercustomfield, { scriptid: 'othercustomfieldid', [INTERNAL_ID]: '6' }),
      new InstanceElement('G', transactionbodycustomfield, {
        scriptid: 'transactionbodycustomfieldid',
        [INTERNAL_ID]: '7',
      }),
      new InstanceElement('H', transactioncolumncustomfield, {
        scriptid: 'transactioncolumncustomfieldid',
        [INTERNAL_ID]: '8',
      }),
    ]
    await setServiceUrl(elements, client)
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/custom/eventcustfield.nl?id=1',
    )
    expect(elements[1].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/custom/entitycustfield.nl?id=2',
    )
    expect(elements[2].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/custom/itemcustfield.nl?id=3',
    )
    expect(elements[3].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/custom/itemnumbercustfield.nl?id=4',
    )
    expect(elements[4].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/custom/itemoption.nl?id=5',
    )
    expect(elements[5].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/custom/othercustfield.nl?id=6',
    )
    expect(elements[6].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/custom/bodycustfield.nl?id=7',
    )
    expect(elements[7].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/custom/columncustfield.nl?id=8',
    )
  })

  it('should not set url if not found internal id', async () => {
    const notFoundElement = new InstanceElement('A2', crmcustomfield, { scriptid: 'someScriptID2' })
    await setServiceUrl([notFoundElement], client)
    expect(notFoundElement.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })
})
