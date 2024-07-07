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
import { Change, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { elementSource } from '@salto-io/workspace'
import { ZENDESK, DYNAMIC_CONTENT_ITEM_TYPE_NAME } from '../../src/constants'
import { duplicateDynamicContentItemValidator } from '../../src/change_validators/duplicate_dynamic_content_item'

const createDynamicContentInstance = (name: string): InstanceElement =>
  new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_TYPE_NAME) }), {
    name,
  })

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
      after = createDynamicContentInstance('dynamicContent')
      changes = [toChange({ after })]
    })

    it('should return an empty array if the existing elements have the same elemID', async () => {
      const existing = createDynamicContentInstance('dynamicContent')

      const elementsSource = elementSource.createInMemoryElementSource([existing])
      const result = await duplicateDynamicContentItemValidator(changes, elementsSource)
      expect(result).toEqual([])
    })
    it('should return an array of the if the existing elements have the same elemID', async () => {
      const existing = createDynamicContentInstance('DynamicContent')

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
  })
})
