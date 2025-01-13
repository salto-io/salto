/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { elementSource } from '@salto-io/workspace'
import { ZENDESK, DYNAMIC_CONTENT_ITEM_TYPE_NAME } from '../../src/constants'
import { duplicateDynamicContentItemValidator } from '../../src/change_validators/duplicate_dynamic_content_item'

const createDynamicContentInstance = (name: string, placeholder: string): InstanceElement =>
  new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_TYPE_NAME) }), {
    name,
    placeholder,
  })

const NAME = 'dynamicContent'
const PLACEHOLDER = 'newPlaceholder'
const SAME_NAME_DIFFERENT_CASE = 'dYnamicContent'
const DIFFERENT_NAME = 'existingContent'
const DIFFERENT_PLACEHOLDER = 'existingPlaceholder'

describe('duplicateDynamicContentItemValidator', () => {
  describe('when there are no relevant changes', () => {
    it('should return an empty array', async () => {
      const changes: Change[] = []
      const result = await duplicateDynamicContentItemValidator(changes, undefined)
      expect(result).toEqual([])
    })
  })

  describe('when there are relevant changes', () => {
    let changes: Change[]
    let after: InstanceElement
    beforeEach(() => {
      after = createDynamicContentInstance(NAME, PLACEHOLDER)
      changes = [toChange({ after })]
    })

    describe('existing elements with same name and different placeholder', () => {
      it('should return an empty array on modification', async () => {
        const existing = createDynamicContentInstance(NAME, DIFFERENT_PLACEHOLDER)
        changes = [toChange({ before: existing, after })]

        const elementsSource = elementSource.createInMemoryElementSource([existing])
        const result = await duplicateDynamicContentItemValidator(changes, elementsSource)
        expect(result).toEqual([])
      })
    })
    describe('existing elements with different (case insensitive) name and different placeholder', () => {
      it('should return an array with an error', async () => {
        const existing = createDynamicContentInstance(SAME_NAME_DIFFERENT_CASE, DIFFERENT_PLACEHOLDER)

        const elementsSource = elementSource.createInMemoryElementSource([existing])
        const result = await duplicateDynamicContentItemValidator(changes, elementsSource)
        expect(result).toEqual([
          {
            elemID: after.elemID,
            severity: 'Error',
            message: 'Cannot do this change since this dynamic content item name is already in use',
            detailedMessage: `The dynamic content item name '${after.value.name}' is already used by the following elements:
${existing.elemID.getFullName()}. Please change the name of the dynamic content item and try again.`,
          },
        ])
      })

      it('should return an array with an error with multiple elements', async () => {
        const existing1 = createDynamicContentInstance(SAME_NAME_DIFFERENT_CASE, DIFFERENT_PLACEHOLDER)
        // Different case
        const existing2 = createDynamicContentInstance('DynamicContent', DIFFERENT_PLACEHOLDER)

        const elementsSource = elementSource.createInMemoryElementSource([existing1, existing2])
        const result = await duplicateDynamicContentItemValidator(changes, elementsSource)
        expect(result).toEqual([
          {
            elemID: after.elemID,
            severity: 'Error',
            message: 'Cannot do this change since this dynamic content item name is already in use',
            detailedMessage: `The dynamic content item name '${after.value.name}' is already used by the following elements:
${existing2.elemID.getFullName()}, ${existing1.elemID.getFullName()}. Please change the name of the dynamic content item and try again.`,
          },
        ])
      })
    })
    describe('existing elements with different name and same placeholder', () => {
      it('should return an array with an error', async () => {
        const existing = createDynamicContentInstance(DIFFERENT_NAME, PLACEHOLDER)
        const elementsSource = elementSource.createInMemoryElementSource([existing])
        const result = await duplicateDynamicContentItemValidator(changes, elementsSource)
        expect(result).toEqual([
          {
            elemID: after.elemID,
            severity: 'Error',
            message: 'Cannot do this change since this dynamic content item placeholder is already in use',
            detailedMessage: `The dynamic content item placeholder '${after.value.placeholder}' is already used by the following elements:
${existing.elemID.getFullName()}. Please change the placeholder of the dynamic content item and try again.`,
          },
        ])
      })
    })
    describe('existing elements with different (case insensitive) name and same placeholder', () => {
      it('should return an array with both errors', async () => {
        const existing = createDynamicContentInstance(SAME_NAME_DIFFERENT_CASE, PLACEHOLDER)
        const elementsSource = elementSource.createInMemoryElementSource([existing])
        const result = await duplicateDynamicContentItemValidator(changes, elementsSource)
        expect(result).toEqual([
          {
            elemID: after.elemID,
            severity: 'Error',
            message: 'Cannot do this change since this dynamic content item name is already in use',
            detailedMessage: `The dynamic content item name '${after.value.name}' is already used by the following elements:
${existing.elemID.getFullName()}. Please change the name of the dynamic content item and try again.`,
          },
          {
            elemID: after.elemID,
            severity: 'Error',
            message: 'Cannot do this change since this dynamic content item placeholder is already in use',
            detailedMessage: `The dynamic content item placeholder '${after.value.placeholder}' is already used by the following elements:
${existing.elemID.getFullName()}. Please change the placeholder of the dynamic content item and try again.`,
          },
        ])
      })
    })
  })
})
