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
import { SUPPORTED_TYPES } from '../../src/config'
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
    const triggerDefinitionType = new ObjectType({
      elemID: new ElemID(ZENDESK_SUPPORT, 'trigger_definition'),
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
    const unsortedTriggerDefinitionInstance = new InstanceElement(
      'unsorted',
      triggerDefinitionType,
      {
        actions: [
          { title: 'alpha', type: 'bravo' },
          { title: 'charlie', type: 'charlie' },
          { title: 'alpha', type: 'alpha' },
        ],
        conditions_all: [
          { title: 'alpha', type: 'alpha' },
          { title: 'charlie', type: 'bravo' },
          { title: 'bravo', type: 'bravo' },
        ],
        conditions_any: [
          { title: 'charlie', type: 'charlie' },
          { title: 'bravo', type: 'bravo' },
          { title: 'bravo', type: 'alpha' },
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
      triggerDefinitionType, unsortedTriggerDefinitionInstance,
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
          supportedTypes: SUPPORTED_TYPES,
        },
      },
    }) as FilterType

    elements = generateElements()
    await filter.onFetch(elements)
  })

  describe('dynamic content item', () => {
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
  describe('trigger definition', () => {
    let instance: InstanceElement
    beforeAll(() => {
      [instance] = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === 'trigger_definition')
    })
    it('should sort actions by title and type', async () => {
      expect(instance.value.actions).toHaveLength(3)
      expect(instance.value.actions[0].title).toEqual('alpha')
      expect(instance.value.actions[0].type).toEqual('alpha')
      expect(instance.value.actions[1].title).toEqual('alpha')
      expect(instance.value.actions[1].type).toEqual('bravo')
      expect(instance.value.actions[2].title).toEqual('charlie')
      expect(instance.value.actions[2].type).toEqual('charlie')
    })
    it('should sort conditions_all by title and type', async () => {
      expect(instance.value.conditions_all).toHaveLength(3)
      expect(instance.value.conditions_all[0].title).toEqual('alpha')
      expect(instance.value.conditions_all[0].type).toEqual('alpha')
      expect(instance.value.conditions_all[1].title).toEqual('bravo')
      expect(instance.value.conditions_all[1].type).toEqual('bravo')
      expect(instance.value.conditions_all[2].title).toEqual('charlie')
      expect(instance.value.conditions_all[2].type).toEqual('bravo')
    })
    it('should sort conditions_any by title and type', async () => {
      expect(instance.value.conditions_any).toHaveLength(3)
      expect(instance.value.conditions_any[0].title).toEqual('bravo')
      expect(instance.value.conditions_any[0].type).toEqual('alpha')
      expect(instance.value.conditions_any[1].title).toEqual('bravo')
      expect(instance.value.conditions_any[1].type).toEqual('bravo')
      expect(instance.value.conditions_any[2].title).toEqual('charlie')
      expect(instance.value.conditions_any[2].type).toEqual('charlie')
    })
  })
})
