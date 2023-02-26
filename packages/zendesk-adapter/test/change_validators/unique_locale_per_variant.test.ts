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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { ZENDESK } from '../../src/constants'
import {
  noDuplicateLocaleIdInDynamicContentItemValidator,
} from '../../src/change_validators/unique_locale_per_variant'
import {
  VARIANTS_FIELD_NAME,
  DYNAMIC_CONTENT_ITEM_TYPE_NAME,
  DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME,
} from '../../src/filters/dynamic_content'

describe('noDuplicateLocaleIdInDynamicContentItemValidator', () => {
  const itemType = new ObjectType({
    elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_TYPE_NAME),
  })
  const variantType = new ObjectType({
    elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME),
  })
  const localeType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'locale'),
  })
  const english = new InstanceElement('en', localeType, { id: 1 })
  const spanish = new InstanceElement('es', localeType, { id: 2 })
  const variant1 = new InstanceElement(
    'var1',
    variantType,
    { name: 'test1', content: 'abc', locale_id: new ReferenceExpression(english.elemID, english) },
  )
  const variant2 = new InstanceElement(
    'var2',
    variantType,
    { name: 'test2', content: 'abc', locale_id: new ReferenceExpression(spanish.elemID, spanish) },
  )
  const item = new InstanceElement(
    'item',
    itemType,
    {
      name: 'test1',
      [VARIANTS_FIELD_NAME]: [
        new ReferenceExpression(variant1.elemID, variant1),
        new ReferenceExpression(variant2.elemID, variant2),
      ],
    },
  )
  variant1.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(item.elemID, item)]
  variant2.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(item.elemID, item)]
  it('should return an error when we add a variant with an already existing locale', async () => {
    const clonedVariant = variant2.clone()
    clonedVariant.value.locale_id = new ReferenceExpression(english.elemID, english)
    const errors = await noDuplicateLocaleIdInDynamicContentItemValidator([
      toChange({ after: clonedVariant }),
    ])
    expect(errors).toEqual([{
      elemID: variant2.elemID,
      severity: 'Error',
      message: 'Can’t change instance since there are other variants with the same locale',
      detailedMessage: `The following variants have the same locale id: ${variant1.elemID.getFullName()}`,
    }])
  })
  it('should not return an error when we add a variant with an new locale', async () => {
    const clonedVariant = variant2.clone()
    const enUs = new InstanceElement('en_US', localeType, { id: 3 })
    clonedVariant.value.locale_id = new ReferenceExpression(enUs.elemID, enUs)
    const errors = await noDuplicateLocaleIdInDynamicContentItemValidator([
      toChange({ after: clonedVariant }),
    ])
    expect(errors).toEqual([])
  })
  it('should not return an error if the variant does not have a parent', async () => {
    const clonedVariant = variant2.clone()
    delete clonedVariant.annotations[CORE_ANNOTATIONS.PARENT]
    const errors = await noDuplicateLocaleIdInDynamicContentItemValidator([
      toChange({ after: clonedVariant }),
    ])
    expect(errors).toEqual([])
  })
  it('should return an error if the variant does not have a parent', async () => {
    const clonedVariant = variant2.clone()
    const item2 = new InstanceElement(
      'item2',
      itemType,
      {
        name: 'test2',
        [VARIANTS_FIELD_NAME]: [
          new ReferenceExpression(variant2.elemID, variant2),
          'some string',
        ],
      },
    )
    clonedVariant.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(item2.elemID, item2)]
    const errors = await noDuplicateLocaleIdInDynamicContentItemValidator([
      toChange({ after: clonedVariant }),
    ])
    expect(errors).toEqual([{
      elemID: clonedVariant.elemID,
      severity: 'Error',
      message: 'Invalid child variant reference in parent dynamic content',
      detailedMessage: `Parent dynamic content ‘${item2.elemID.getFullName()}’ includes an invalid child variant reference.`,
    }])
  })
  it('should return an error if the variant does not have a locale', async () => {
    const clonedVariant = variant2.clone()
    delete clonedVariant.value.locale_id
    const errors = await noDuplicateLocaleIdInDynamicContentItemValidator([
      toChange({ after: clonedVariant }),
    ])
    expect(errors).toEqual([{
      elemID: clonedVariant.elemID,
      severity: 'Error',
      message: 'Can’t change an instance with an invalid locale',
      detailedMessage: 'Can’t change an instance with an invalid locale',
    }])
  })
})
