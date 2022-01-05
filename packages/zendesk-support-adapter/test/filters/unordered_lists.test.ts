/*
*                      Copyright 2022 Salto Labs Ltd.
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
  ObjectType, ElemID, InstanceElement, Element, isInstanceElement, ReferenceExpression,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import ZendeskClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { ZENDESK_SUPPORT } from '../../src/constants'
import filterCreator from '../../src/filters/unordered_lists'

describe('Unordered lists filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const generateElements = (): Element[] => {
    const localeType = new ObjectType({
      elemID: new ElemID(ZENDESK_SUPPORT, 'locale'),
    })
    const localeEN = new InstanceElement(
      'en_US',
      localeType,
      { locale: 'en-US' },
    )
    const localeHE = new InstanceElement(
      'he',
      localeType,
      { locale: 'he' },
    )
    const localeES = new InstanceElement(
      'es',
      localeType,
      { locale: 'es' },
    )

    const dynamicContentItemType = new ObjectType({
      elemID: new ElemID(ZENDESK_SUPPORT, 'dynamic_content_item'),
    })
    const withPopulatedRefs = new InstanceElement(
      'refs',
      dynamicContentItemType,
      {
        variants: [
          { locale_id: new ReferenceExpression(localeEN.elemID, localeEN), content: 'a' },
          { locale_id: new ReferenceExpression(localeHE.elemID, localeHE), content: 'c' },
          { locale_id: new ReferenceExpression(localeES.elemID, localeES), content: 'b' },
        ],
      },
    )
    const withSomeUnpopulatedRefs = new InstanceElement(
      'missing',
      dynamicContentItemType,
      {
        variants: [
          { locale_id: new ReferenceExpression(localeEN.elemID), content: 'a' },
          { locale_id: new ReferenceExpression(localeHE.elemID), content: 'c' },
          { locale_id: new ReferenceExpression(localeES.elemID, localeES), content: 'b' },
        ],
      },
    )
    const withSomeValues = new InstanceElement(
      'vals',
      dynamicContentItemType,
      {
        variants: [
          { locale_id: 456, content: 'b' },
          { locale_id: 123, content: 'a' },
          { locale_id: new ReferenceExpression(localeEN.elemID, localeEN), content: 'c' },
        ],
      },
    )
    const empty = new InstanceElement(
      'empty',
      dynamicContentItemType,
      {},
    )
    return [
      localeType, localeEN, localeHE, localeES,
      dynamicContentItemType, withPopulatedRefs, withSomeUnpopulatedRefs, withSomeValues, empty,
    ]
  }

  let elements: Element[]

  beforeAll(async () => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: {
        fetch: {
          includeTypes: [],
        },
        apiDefinitions: {
          typeDefaults: {
            transformation: {
              idFields: ['name'],
            },
          },
          types: {},
        },
      },
    }) as FilterType

    elements = generateElements()
    await filter.onFetch(elements)
  })

  it('sort correctly when all references are populated', async () => {
    const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'refs')
    expect(instances[0].value.variants).toHaveLength(3)
    expect(instances[0].value.variants[0].locale_id.elemID.name).toEqual('en_US')
    expect(instances[0].value.variants[1].locale_id.elemID.name).toEqual('es')
    expect(instances[0].value.variants[2].locale_id.elemID.name).toEqual('he')
  })

  it('not change order when not all references are populated', async () => {
    const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'missing')
    expect(instances[0].value.variants).toHaveLength(3)
    expect(instances[0].value.variants[0].locale_id.elemID.name).toEqual('en_US')
    expect(instances[0].value.variants[1].locale_id.elemID.name).toEqual('he')
    expect(instances[0].value.variants[2].locale_id.elemID.name).toEqual('es')
  })

  it('not change order when not all values are references', async () => {
    const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'vals')
    expect(instances[0].value.variants).toHaveLength(3)
    expect(instances[0].value.variants[0].locale_id).toEqual(456)
    expect(instances[0].value.variants[1].locale_id).toEqual(123)
    expect(instances[0].value.variants[2].locale_id.elemID.name).toEqual('en_US')
  })
  it('do nothing when instance structure is not as expected', async () => {
    const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'empty')
    expect(instances[0].value).toEqual({})
  })
})
