/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { DYNAMIC_CONTENT_ITEM_TYPE_NAME, ZENDESK } from '../../src/constants'
import { emptyVariantsValidator } from '../../src/change_validators/empty_variants'
import { VARIANTS_FIELD_NAME } from '../../src/filters/dynamic_content'

describe('emptyVariantsValidator', () => {
  const itemType = new ObjectType({
    elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_TYPE_NAME),
  })
  const item = new InstanceElement('field1', itemType, { name: 'test1', [VARIANTS_FIELD_NAME]: [] })
  it('should return an error when we add field with no variants', async () => {
    const errors = await emptyVariantsValidator([toChange({ after: item })])
    expect(errors).toEqual([
      {
        elemID: item.elemID,
        severity: 'Error',
        message: 'Cannot make this change due to missing variants',
        detailedMessage: 'Dynamic content item must have at least one variant',
      },
    ])
  })
  it('should not return an error when we remove an item', async () => {
    const errors = await emptyVariantsValidator([toChange({ before: item })])
    expect(errors).toHaveLength(0)
  })
  it('should not return an error when there are variants', async () => {
    const clonedItem = item.clone()
    const variant = new InstanceElement(
      'option1',
      new ObjectType({ elemID: new ElemID(ZENDESK, 'dynamic_content_item__variants') }),
      { content: 'test', locale_id: 1 },
    )
    clonedItem.value[VARIANTS_FIELD_NAME] = [new ReferenceExpression(variant.elemID, variant)]
    const errors = await emptyVariantsValidator([toChange({ after: clonedItem })])
    expect(errors).toHaveLength(0)
  })
})
