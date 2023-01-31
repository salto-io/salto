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
import { filterUtils } from '@salto-io/adapter-components'
import {
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  TemplateExpression,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { FilterResult } from '../../src/filter'
import { BRAND_TYPE_NAME, SUPPORT_ADDRESS_TYPE_NAME, ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/support_address'
import { createFilterCreatorParams } from '../utils'


describe('support address filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy' | 'preDeploy', FilterResult>
  let filter: FilterType

  const brandType = new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) })
  const supportAddressType = new ObjectType({ elemID: new ElemID(ZENDESK, SUPPORT_ADDRESS_TYPE_NAME) })

  const brand1 = new InstanceElement('brand1', brandType, { subdomain: 'one' })
  const brand2 = new InstanceElement('brand2', brandType, { subdomain: 'two' })

  const supportAddressZendesk = new InstanceElement(
    'address1',
    supportAddressType,
    {
      email: 'support.1@one.zendesk.com',
    }
  )
  const supportAddressZendeskAfterFetch = new InstanceElement(
    'address1',
    supportAddressType,
    {
      email: new TemplateExpression({
        parts: [
          'support.1@',
          new ReferenceExpression(brand1.elemID.createNestedID('subdomain'), brand1.value.subdomain),
          '.zendesk.com',
        ],
      }),
    }
  )
  const supportAddressOther = new InstanceElement(
    'address2',
    supportAddressType,
    {
      email: 'support1@gmail.com',
    }
  )
  const supportAddressUndefined = new InstanceElement(
    'address3',
    supportAddressType,
    {}
  )

  beforeAll(() => {
    const elementsSource = buildElementsSourceFromElements([supportAddressZendesk, supportAddressOther, brand1, brand2])

    filter = filterCreator(createFilterCreatorParams({ elementsSource })) as FilterType
  })
  describe('onFetch', () => {
    it('should turn zendesk emails to template expression', async () => {
      const elements = [
        supportAddressZendesk,
        supportAddressOther,
        supportAddressUndefined,
        brand1,
        brand2,
      ].map(e => e.clone())
      await filter.onFetch(elements)
      const zendeskAddress = elements.find(e => e.elemID.name === 'address1')
      const otherAddress = elements.find(e => e.elemID.name === 'address2')
      const undefinedAddress = elements.find(e => e.elemID.name === 'address3')
      expect(zendeskAddress).toBeDefined()
      expect(otherAddress).toBeDefined()
      expect(undefinedAddress).toBeDefined()
      if (zendeskAddress === undefined || otherAddress === undefined || undefinedAddress === undefined) {
        return
      }
      expect(zendeskAddress).toEqual(supportAddressZendeskAfterFetch)
      expect(otherAddress).toEqual(supportAddressOther)
      expect(undefinedAddress).toEqual(supportAddressUndefined)
    })
  })
  describe('preDeploy', () => {
    it('should turn zendesk emails from template expression to string', async () => {
      const elements = [
        supportAddressZendeskAfterFetch,
        supportAddressOther,
        supportAddressUndefined,
      ].map(e => e.clone())
      await filter.preDeploy(elements.map(elem => toChange({ after: elem })))
      const zendeskAddress = elements.find(e => e.elemID.name === 'address1')
      const otherAddress = elements.find(e => e.elemID.name === 'address2')
      const undefinedAddress = elements.find(e => e.elemID.name === 'address3')
      expect(zendeskAddress).toBeDefined()
      expect(otherAddress).toBeDefined()
      expect(undefinedAddress).toBeDefined()
      if (zendeskAddress === undefined || otherAddress === undefined || undefinedAddress === undefined) {
        return
      }
      expect(zendeskAddress).toEqual(supportAddressZendesk)
      expect(otherAddress).toEqual(supportAddressOther)
      expect(undefinedAddress).toEqual(supportAddressUndefined)
    })
  })
  describe('onDeploy', () => {
    let elementsAfterFetch: (InstanceElement | ObjectType)[]
    let elementsAfterOnDeploy: (InstanceElement | ObjectType)[]

    beforeAll(async () => {
      const elementsBeforeFetch = [
        supportAddressZendesk,
        supportAddressOther,
        supportAddressUndefined,
        brand1,
        brand2,
      ]
      elementsAfterFetch = elementsBeforeFetch.map(e => e.clone())
      await filter.onFetch(elementsAfterFetch)
      const elementsAfterPreDeploy = elementsAfterFetch.map(e => e.clone())
      await filter.preDeploy(elementsAfterPreDeploy.map(e => toChange({ before: e, after: e })))
      elementsAfterOnDeploy = elementsAfterPreDeploy.map(e => e.clone())
      await filter.onDeploy(elementsAfterOnDeploy.map(e => toChange({ before: e, after: e })))
    })

    it('Returns elements to after fetch state (with templates) after onDeploy', () => {
      expect(elementsAfterOnDeploy).toEqual(elementsAfterFetch)
    })
    it('should not turn to template expression if it was not a template expression before', async () => {
      const supportAddress = new InstanceElement(
        'address1',
        supportAddressType,
        {
          email: 'support.1@one.zendesk.com',
        }
      )
      const cloned = supportAddress.clone()
      await filter.preDeploy([toChange({ before: supportAddress, after: supportAddress })])
      await filter.onDeploy([toChange({ before: supportAddress, after: supportAddress })])
      expect(supportAddress).toEqual(cloned)
    })
  })
})
