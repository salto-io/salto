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
  InstanceElement,
  toChange,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  ObjectType,
  ElemID,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import {
  BRAND_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_NAME,
  SECTION_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'
import { createOrderType } from '../../src/filters/guide_order/guide_order_utils'
import { orderDependencyChanger } from '../../src/dependency_changers/order_change'

describe('guideOrderDependencyChanger', () => {
  const brand = new InstanceElement('brand', new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) }))
  const category = new InstanceElement('category', new ObjectType({ elemID: new ElemID(ZENDESK, CATEGORY_TYPE_NAME) }))
  const section = new InstanceElement('section', new ObjectType({ elemID: new ElemID(ZENDESK, SECTION_TYPE_NAME) }))
  const customObject = new InstanceElement(
    'customObject',
    new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_OBJECT_TYPE_NAME) }),
  )
  const categoriesOrder = new InstanceElement('categories', createOrderType(CATEGORY_TYPE_NAME), {}, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brand.elemID, brand)],
  })
  const sectionsInCategoryOrder = new InstanceElement(
    'sectionsInCategory',
    createOrderType(CATEGORY_TYPE_NAME),
    {},
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(category.elemID, category)] },
  )
  const sectionsInSectionOrder = new InstanceElement(
    'sectionsInSection',
    createOrderType(CATEGORY_TYPE_NAME),
    {},
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(section.elemID, section)] },
  )
  const articlesOrder = new InstanceElement('articles', createOrderType(CATEGORY_TYPE_NAME), {}, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(section.elemID, section)],
  })
  const customObjectFieldsOrder = new InstanceElement(
    'customObjectFields',
    createOrderType(CATEGORY_TYPE_NAME),
    {},
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(customObject.elemID, customObject)] },
  )

  it('should remove dependency from the order instances to their parents', async () => {
    const inputChanges = new Map([
      [0, toChange({ before: brand })],
      [1, toChange({ before: category })],
      [2, toChange({ before: section })],
      [3, toChange({ before: categoriesOrder })],
      [4, toChange({ before: sectionsInCategoryOrder })],
      [5, toChange({ before: sectionsInSectionOrder })],
      [6, toChange({ before: articlesOrder })],
      [7, toChange({ before: customObject })],
      [8, toChange({ before: customObjectFieldsOrder })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
      [2, new Set()],
      [3, new Set()],
      [4, new Set()],
      [5, new Set()],
      [6, new Set()],
    ])

    const dependencyChanges = [...(await orderDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges.length).toBe(5)
    expect(dependencyChanges.every(change => change.action === 'remove')).toBe(true)
    expect(dependencyChanges[0].dependency).toMatchObject({ source: 3, target: 0 })
    expect(dependencyChanges[1].dependency).toMatchObject({ source: 4, target: 1 })
    expect(dependencyChanges[2].dependency).toMatchObject({ source: 5, target: 2 })
    expect(dependencyChanges[3].dependency).toMatchObject({ source: 6, target: 2 })
    expect(dependencyChanges[4].dependency).toMatchObject({ source: 8, target: 7 })
  })
})
