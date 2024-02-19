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
import { ObjectType, ElemID, InstanceElement, Element, ReferenceExpression } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { SUPPORTED_TYPES } from '../../src/config'
import ZuoraClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { ZUORA_BILLING, PRODUCT_RATE_PLAN_TYPE, ACCOUNTING_CODE_ITEM_TYPE } from '../../src/constants'
import filterCreator from '../../src/filters/finance_information_references'

describe('finance information references filter', () => {
  let client: ZuoraClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const generateElements = (): Element[] => {
    const productRatePlanType = new ObjectType({
      elemID: new ElemID(ZUORA_BILLING, PRODUCT_RATE_PLAN_TYPE),
    })

    const productRatePlanInstance = new InstanceElement('rate_plan', productRatePlanType, {
      productRatePlanCharges: [
        {
          description: 'charges with finance information',
          financeInformation: {
            someAccountingCode: 'Check',
            someAccountingCodeType: 'Cash',
            notAnAccountingCode: 'invalid',
            notAnAccountingCodeType: 'also invalid',
          },
        },
        {
          description: 'charges without finance information',
        },
      ],
    })

    const productRatePlanInstance2 = new InstanceElement('rate_plan2', productRatePlanType)

    const accountingCodeItemType = new ObjectType({
      elemID: new ElemID(ZUORA_BILLING, ACCOUNTING_CODE_ITEM_TYPE),
    })

    const accountingCodeItem = new InstanceElement('Cash_Check', accountingCodeItemType, {
      name: 'Check',
      type: 'Cash',
    })

    return [
      productRatePlanType,
      productRatePlanInstance,
      productRatePlanInstance2,
      accountingCodeItemType,
      accountingCodeItem,
    ]
  }

  beforeAll(() => {
    client = new ZuoraClient({
      credentials: { baseURL: 'http://localhost', clientId: 'id', clientSecret: 'secret' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: {
        fetch: {
          include: [],
          exclude: [],
        },
        apiDefinitions: {
          swagger: { url: 'ignore' },
          typeDefaults: {
            transformation: {
              idFields: ['name'],
            },
          },
          types: {},
          supportedTypes: SUPPORTED_TYPES,
        },
      },
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  describe('finance information references', () => {
    let origElements: Element[]
    let elements: Element[]
    beforeAll(async () => {
      origElements = generateElements()
      elements = generateElements()
      await filter.onFetch(elements)
    })
    it('should add references', () => {
      expect(elements).not.toEqual(origElements)
      expect(elements.length).toEqual(origElements.length)

      const ratePlan = elements.find(e => e.elemID.name === 'rate_plan') as InstanceElement
      const { financeInformation } = ratePlan.value.productRatePlanCharges[0]
      expect(financeInformation.someAccountingCode).toBeInstanceOf(ReferenceExpression)
      expect(financeInformation.someAccountingCode.elemID.getFullName()).toEqual(
        `zuora_billing.${ACCOUNTING_CODE_ITEM_TYPE}.instance.Cash_Check`,
      )
      expect(financeInformation.someAccountingCodeType).toBeUndefined()

      // if the accounting code item doesn't exists the value isn't replaced
      expect(financeInformation.notAnAccountingCode).toEqual('invalid')
      expect(financeInformation.notAnAccountingCodeType).toEqual('also invalid')
    })
  })
  it('should return when theres no accounting code items', async () => {
    const origElements = generateElements().filter(e => e.elemID.typeName !== ACCOUNTING_CODE_ITEM_TYPE)
    const elements = generateElements().filter(e => e.elemID.typeName !== ACCOUNTING_CODE_ITEM_TYPE)
    await filter.onFetch(elements)
    expect(elements).toEqual(origElements)
  })
})
