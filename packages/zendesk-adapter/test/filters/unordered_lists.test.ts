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
import {
  ObjectType, ElemID, InstanceElement, Element, isInstanceElement, ReferenceExpression,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/unordered_lists'
import { createFilterCreatorParams } from '../utils'
import { DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME } from '../../src/filters/dynamic_content'

describe('Unordered lists filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const generateElements = (): Element[] => {
    const localeType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'locale'),
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
      elemID: new ElemID(ZENDESK, 'dynamic_content_item'),
    })
    const dynamicContentItemVariantType = new ObjectType({
      elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME),
    })
    const triggerDefinitionType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'trigger_definition'),
    })
    const enVariantInstance = new InstanceElement(
      'en-variant',
      dynamicContentItemVariantType,
      { locale_id: new ReferenceExpression(localeEN.elemID, localeEN), content: 'a' },
    )
    const heVariantInstance = new InstanceElement(
      'he-variant',
      dynamicContentItemVariantType,
      { locale_id: new ReferenceExpression(localeHE.elemID, localeHE), content: 'c' },
    )
    const esVariantInstance = new InstanceElement(
      'es-variant',
      dynamicContentItemVariantType,
      { locale_id: new ReferenceExpression(localeES.elemID, localeES), content: 'b' },
    )
    const enVariantNotPopulatedInstance = new InstanceElement(
      'en-variant not populated',
      dynamicContentItemVariantType,
      { locale_id: new ReferenceExpression(localeEN.elemID), content: 'a' },
    )
    const enVariantWithValuesInstance = new InstanceElement(
      'en-variant no locale',
      dynamicContentItemVariantType,
      { locale_id: 3, content: 'a' },
    )
    const withPopulatedRefs = new InstanceElement(
      'refs',
      dynamicContentItemType,
      {
        variants: [
          new ReferenceExpression(enVariantInstance.elemID, enVariantInstance),
          new ReferenceExpression(heVariantInstance.elemID, heVariantInstance),
          new ReferenceExpression(esVariantInstance.elemID, esVariantInstance),
        ],
      },
    )
    const withSomeUnpopulatedRefs = new InstanceElement(
      'missingRefs',
      dynamicContentItemType,
      {
        variants: [
          new ReferenceExpression(enVariantInstance.elemID),
          new ReferenceExpression(heVariantInstance.elemID),
          new ReferenceExpression(esVariantInstance.elemID, esVariantInstance),
        ],
      },
    )
    const withSomeUnpopulatedLocaleRefs = new InstanceElement(
      'missingLocalRefs',
      dynamicContentItemType,
      {
        variants: [
          new ReferenceExpression(enVariantNotPopulatedInstance.elemID, enVariantNotPopulatedInstance),
          new ReferenceExpression(heVariantInstance.elemID, heVariantInstance),
          new ReferenceExpression(esVariantInstance.elemID, esVariantInstance),
        ],
      },
    )
    const withSomeValues = new InstanceElement(
      'vals',
      dynamicContentItemType,
      {
        variants: [
          123,
          new ReferenceExpression(heVariantInstance.elemID, heVariantInstance),
          new ReferenceExpression(esVariantInstance.elemID, esVariantInstance),
        ],
      },
    )
    const withSomeValuesForLocal = new InstanceElement(
      'valsLocal',
      dynamicContentItemType,
      {
        variants: [
          new ReferenceExpression(enVariantWithValuesInstance.elemID, enVariantWithValuesInstance),
          new ReferenceExpression(heVariantInstance.elemID, heVariantInstance),
          new ReferenceExpression(esVariantInstance.elemID, esVariantInstance),
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
      triggerDefinitionType, unsortedTriggerDefinitionInstance, enVariantInstance, esVariantInstance, heVariantInstance,
      enVariantNotPopulatedInstance, enVariantWithValuesInstance, withSomeUnpopulatedLocaleRefs, withSomeValuesForLocal,
    ]
  }

  let elements: Element[]

  beforeAll(async () => {
    filter = filterCreator(createFilterCreatorParams({})) as FilterType

    elements = generateElements()
    await filter.onFetch(elements)
  })

  describe('dynamic content item', () => {
    it('sort correctly when all references are populated', async () => {
      const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'refs')
      expect(instances[0].value.variants).toHaveLength(3)
      expect(instances[0].value.variants[0].elemID.name).toEqual('en-variant')
      expect(instances[0].value.variants[1].elemID.name).toEqual('es-variant')
      expect(instances[0].value.variants[2].elemID.name).toEqual('he-variant')
    })
    it('sort correctly even when not all references are populated', async () => {
      const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'missingRefs')
      expect(instances[0].value.variants).toHaveLength(3)
      expect(instances[0].value.variants[0].elemID.name).toEqual('en-variant')
      expect(instances[0].value.variants[1].elemID.name).toEqual('es-variant')
      expect(instances[0].value.variants[2].elemID.name).toEqual('he-variant')
    })
    it('not change order when not all values are references', async () => {
      const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'vals')
      expect(instances[0].value.variants).toHaveLength(3)
      expect(instances[0].value.variants[0]).toEqual(123)
      expect(instances[0].value.variants[1].elemID.name).toEqual('he-variant')
      expect(instances[0].value.variants[2].elemID.name).toEqual('es-variant')
    })
    it('not change order when some all locale_id are values', async () => {
      const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'valsLocal')
      expect(instances[0].value.variants).toHaveLength(3)
      expect(instances[0].value.variants[0].elemID.name).toEqual('en-variant no locale')
      expect(instances[0].value.variants[1].elemID.name).toEqual('he-variant')
      expect(instances[0].value.variants[2].elemID.name).toEqual('es-variant')
    })
    it('not change order when not all locale_id are populated', async () => {
      const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'missingLocalRefs')
      expect(instances[0].value.variants).toHaveLength(3)
      expect(instances[0].value.variants[0].elemID.name).toEqual('en-variant not populated')
      expect(instances[0].value.variants[1].elemID.name).toEqual('he-variant')
      expect(instances[0].value.variants[2].elemID.name).toEqual('es-variant')
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
