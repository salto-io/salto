/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  Change,
  ElemID,
  InstanceElement,
  isInstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { DYNAMIC_CONTENT_ITEM_TYPE_NAME, ZENDESK } from '../../src/constants'
import { DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME } from '../../src/filters/dynamic_content'
import { defaultDynamicContentItemVariantValidator } from '../../src/change_validators'

const dynamicContentItem = new InstanceElement(
  'item',
  new ObjectType({ elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_TYPE_NAME) }),
  { variants: [] },
)

const defaultVariant = new InstanceElement(
  'defaultVariant',
  new ObjectType({ elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME) }),
  { default: true },
  [],
  {
    _parent: new ReferenceExpression(dynamicContentItem.elemID, dynamicContentItem),
  },
)

const notDefaultVariant = new InstanceElement(
  'notDefaultVariant',
  new ObjectType({ elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME) }),
  { default: false },
  [],
  {
    _parent: new ReferenceExpression(dynamicContentItem.elemID, dynamicContentItem),
  },
)

const invalidVariant = {
  invalid: 'test',
} as const

const setDynamicContentItemVariants = (variants: (InstanceElement | typeof invalidVariant)[]): void => {
  dynamicContentItem.value.variants = variants.map(
    variant =>
      new ReferenceExpression(
        isInstanceElement(variant) ? variant.elemID : ElemID.fromFullName('zendesk.mock.instance.invalid'),
        variant,
      ),
  )
}

describe('defaultDynamicContentItemVariantValidator', () => {
  beforeEach(() => {
    dynamicContentItem.value.variants = []
  })
  describe('when unsetting or removing a default variant', () => {
    it('should error when the default variant was removed or unset without a new one', async () => {
      const changes = [
        toChange({ before: defaultVariant, after: notDefaultVariant }),
        toChange({ before: defaultVariant }),
      ]
      setDynamicContentItemVariants([notDefaultVariant])
      const errors = await defaultDynamicContentItemVariantValidator(changes)
      expect(errors).toMatchObject([
        {
          elemID: notDefaultVariant.elemID,
          severity: 'Error',
          message: 'Parent dynamic content item must have a default variant',
          detailedMessage: `If you change the default setting of this variant to false, there will be no other variant set as the default for the dynamic content item '${dynamicContentItem.elemID.name}'. Please ensure that you select another variant of this dynamic content item as the default`,
        },
        {
          elemID: defaultVariant.elemID,
          severity: 'Error',
          message: 'Parent dynamic content item must have a default variant',
          detailedMessage: `If you change the default setting of this variant to false, there will be no other variant set as the default for the dynamic content item '${dynamicContentItem.elemID.name}'. Please ensure that you select another variant of this dynamic content item as the default`,
        },
      ])
    })
    it('should not error when the default variant was removed and a new one was added', async () => {
      const changes = [
        toChange({ before: defaultVariant, after: notDefaultVariant }),
        toChange({ before: notDefaultVariant, after: defaultVariant }),
      ]
      setDynamicContentItemVariants([defaultVariant, notDefaultVariant])
      const errors = await defaultDynamicContentItemVariantValidator(changes)
      expect(errors.length).toBe(0)
    })
    it('should do nothing on removal and modification of non-default variants', async () => {
      const changes = [
        toChange({ before: notDefaultVariant, after: notDefaultVariant }),
        toChange({ before: notDefaultVariant }),
      ]
      setDynamicContentItemVariants([notDefaultVariant])
      const errors = await defaultDynamicContentItemVariantValidator(changes)
      expect(errors.length).toBe(0)
    })
    it('should do nothing on modification of a default variant the stays default', async () => {
      const changes = [toChange({ before: defaultVariant, after: defaultVariant })]
      // notDefaultVariant to make sure it doesn't reach the error case
      setDynamicContentItemVariants([notDefaultVariant])
      const errors = await defaultDynamicContentItemVariantValidator(changes)
      expect(errors.length).toBe(0)
    })
  })
  describe('when adding a new dynamic content item', () => {
    let changes: Change<InstanceElement>[]
    beforeEach(() => {
      changes = [toChange({ after: dynamicContentItem })]
    })
    it('should return an error on an addition of dynamic content item without a default variant', async () => {
      setDynamicContentItemVariants([notDefaultVariant])
      const errors = await defaultDynamicContentItemVariantValidator(changes)
      expect(errors).toMatchObject([
        {
          elemID: dynamicContentItem.elemID,
          severity: 'Error',
          message: 'Dynamic content item must have a default variant',
          detailedMessage: `The dynamic content item '${dynamicContentItem.elemID.name}' must have a default variant. Please ensure that you select a variant of this dynamic content item as the default`,
        },
      ])
    })
    it('should not return an error on an addition of dynamic content item without variants', async () => {
      // Set empty array variants
      setDynamicContentItemVariants([])
      const arrayErrors = await defaultDynamicContentItemVariantValidator(changes)
      expect(arrayErrors.length).toBe(0)
      // Set no variants
      dynamicContentItem.value.variants = null
      const nullErrors = await defaultDynamicContentItemVariantValidator(changes)
      expect(nullErrors.length).toBe(0)
    })
    it('should disregard unresolved variants', async () => {
      const unresolvedVariant = new ReferenceExpression(new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME))
      dynamicContentItem.value.variants = [unresolvedVariant]
      const arrayErrors = await defaultDynamicContentItemVariantValidator(changes)
      expect(arrayErrors.length).toBe(0)
    })
    it('should not throw when one of the variants in not a valid InstanceElement', async () => {
      setDynamicContentItemVariants([invalidVariant])
      await expect(defaultDynamicContentItemVariantValidator(changes)).resolves.not.toThrow()
    })
  })
})
