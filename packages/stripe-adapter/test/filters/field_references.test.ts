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
import {
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  Element,
  BuiltinTypes,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/field_references'
import StripeClient from '../../src/client/client'
import { STRIPE } from '../../src/constants'
import { DEFAULT_CONFIG } from '../../src/config'

describe('Field references filter', () => {
  let client: StripeClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  beforeAll(() => {
    client = new StripeClient({
      credentials: { token: 'token' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: () => clientUtils.getWithCursorPagination(),
      }),
      config: DEFAULT_CONFIG,
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  const priceType = new ObjectType({
    elemID: new ElemID(STRIPE, 'price'),
    fields: {
      product: { refType: BuiltinTypes.STRING },
    },
  })
  const productType = new ObjectType({
    elemID: new ElemID(STRIPE, 'product'),
    fields: {
      id: { refType: BuiltinTypes.STRING },
    },
  })
  const planType = new ObjectType({
    elemID: new ElemID(STRIPE, 'plan'),
    fields: {
      product: { refType: BuiltinTypes.UNKNOWN },
    },
  })
  const someOtherType = new ObjectType({
    elemID: new ElemID(STRIPE, 'OtherType'),
    fields: {
      product: { refType: BuiltinTypes.STRING },
    },
  })

  const generateElements = (): Element[] => [
    priceType,
    new InstanceElement('price', priceType, { product: 'prod' }),
    new InstanceElement('price1', priceType, { product: 'anotherProd' }),
    planType,
    new InstanceElement('plan', planType, { product: 'prod' }),
    new InstanceElement('plan1', planType, { product: 'anotherProd' }),
    productType,
    new InstanceElement('testProduct', productType, { id: 'prod' }),
    someOtherType,
    new InstanceElement('otherType55', someOtherType, { product: 'testProduct' }),
  ]

  describe('on fetch', () => {
    let elements: Element[]

    beforeAll(async () => {
      elements = generateElements()
      await filter.onFetch(elements)
    })

    it('should resolve field values when referenced element exists', () => {
      const price = elements.filter(e => isInstanceElement(e) && e.elemID.name === 'price')[0] as InstanceElement
      expect(price.value.product).toBeInstanceOf(ReferenceExpression)
      expect(price.value.product?.elemID.getFullName()).toEqual('stripe.product.instance.testProduct')

      const plan = elements.filter(e => isInstanceElement(e) && e.elemID.name === 'plan')[0] as InstanceElement
      expect(plan.value.product).toBeInstanceOf(ReferenceExpression)
      expect(plan.value.product?.elemID.getFullName()).toEqual('stripe.product.instance.testProduct')
    })

    it('should not resolve fields in unexpected types even if field name matches', () => {
      const others = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'OtherType',
      ) as InstanceElement[]
      expect(others[0].value.product).not.toBeInstanceOf(ReferenceExpression)
    })

    it('should not resolve if referenced element does not exist', () => {
      const price = elements.filter(e => isInstanceElement(e) && e.elemID.name === 'price1')[0] as InstanceElement
      expect(price.value.product).not.toBeInstanceOf(ReferenceExpression)
      expect(price.value.product).toEqual('anotherProd')

      const plan = elements.filter(e => isInstanceElement(e) && e.elemID.name === 'plan1')[0] as InstanceElement
      expect(plan.value.product).not.toBeInstanceOf(ReferenceExpression)
      expect(plan.value.product).toEqual('anotherProd')
    })
  })
})
