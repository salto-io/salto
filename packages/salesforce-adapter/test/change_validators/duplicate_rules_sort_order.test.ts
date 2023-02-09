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
import { ChangeError, getChangeData, InstanceElement, ReadOnlyElementsSource, toChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import changeValidator from '../../src/change_validators/duplicate_rules_sort_order'
import { mockTypes } from '../mock_elements'
import { INSTANCE_FULL_NAME_FIELD } from '../../src/constants'

const { awu } = collections.asynciterable

describe('duplicateRulesSortOrder', () => {
  const ADDITION_OBJECT_NAME = 'Account'
  const MODIFICATION_OBJECT_NAME = 'Case'

  const ADDITION_INSTANCE_NAME = 'addedDuplicateRule'
  const MODIFICATION_INSTANCE_NAME = 'modifiedDuplicateRule'

  type CreateDuplicateRuleInstanceParams = {
    instanceName: string
    objectName: string
    sortOrder: number
  }

  let changeErrors: readonly ChangeError[]
  let changedInstances: InstanceElement[]

  const createDuplicateRuleInstance = ({
    instanceName,
    objectName,
    sortOrder,
  }: CreateDuplicateRuleInstanceParams): InstanceElement => (
    new InstanceElement(
      instanceName,
      mockTypes.DuplicateRule,
      {
        [INSTANCE_FULL_NAME_FIELD]: `${objectName}.${instanceName}`,
        sortOrder,
      }
    )
  )

  const createMockElementsSource = (instances: InstanceElement[]): ReadOnlyElementsSource => ({
    getAll: async () => awu(instances),
    list: async () => awu([]),
    has: async () => true,
    get: async () => undefined,
  })

  describe('when duplicate rules are not in sequential order', () => {
    beforeEach(async () => {
      const modificationChange = toChange({
        before: createDuplicateRuleInstance({
          instanceName: MODIFICATION_INSTANCE_NAME,
          objectName: MODIFICATION_OBJECT_NAME,
          sortOrder: 2,
        }),
        after: createDuplicateRuleInstance({
          instanceName: MODIFICATION_INSTANCE_NAME,
          objectName: MODIFICATION_OBJECT_NAME,
          sortOrder: 1,
        }),
      })
      const additionChange = toChange({
        after: createDuplicateRuleInstance({
          instanceName: ADDITION_INSTANCE_NAME,
          objectName: ADDITION_OBJECT_NAME,
          sortOrder: 1,
        }),
      })
      const existingDuplicateRuleInstances = [
        createDuplicateRuleInstance({
          instanceName: 'existingDuplicateRule1',
          objectName: ADDITION_OBJECT_NAME,
          sortOrder: 1,
        }),
        createDuplicateRuleInstance({
          instanceName: 'existingDuplicateRule2',
          objectName: MODIFICATION_OBJECT_NAME,
          sortOrder: 1,
        }),
      ]
      const changes = [additionChange, modificationChange]
      changedInstances = changes.map(getChangeData)
      const allInstances = [
        ...existingDuplicateRuleInstances,
        ...changedInstances,
      ]
      const elementsSource = createMockElementsSource(allInstances)
      changeErrors = await changeValidator(changes, elementsSource)
    })
    it('should create errors', () => {
      expect(changeErrors.map(error => error.elemID))
        .toEqual(changedInstances.map(instance => instance.elemID))
    })
  })

  describe('when duplicate rules are in sequential order', () => {
    beforeEach(async () => {
      const modificationChange = toChange({
        before: createDuplicateRuleInstance({
          instanceName: MODIFICATION_INSTANCE_NAME,
          objectName: MODIFICATION_OBJECT_NAME,
          sortOrder: 2,
        }),
        after: createDuplicateRuleInstance({
          instanceName: MODIFICATION_INSTANCE_NAME,
          objectName: MODIFICATION_OBJECT_NAME,
          sortOrder: 1,
        }),
      })
      const additionChange = toChange({
        after: createDuplicateRuleInstance({
          instanceName: ADDITION_INSTANCE_NAME,
          objectName: ADDITION_OBJECT_NAME,
          sortOrder: 1,
        }),
      })
      const existingDuplicateRuleInstances = [
        createDuplicateRuleInstance({
          instanceName: 'existingDuplicateRule1',
          objectName: ADDITION_OBJECT_NAME,
          sortOrder: 2,
        }),
        createDuplicateRuleInstance({
          instanceName: 'existingDuplicateRule2',
          objectName: MODIFICATION_OBJECT_NAME,
          sortOrder: 2,
        }),
      ]
      const changes = [additionChange, modificationChange]
      changedInstances = changes.map(getChangeData)
      const allInstances = [
        ...existingDuplicateRuleInstances,
        ...changedInstances,
      ]
      const elementsSource = createMockElementsSource(allInstances)
      changeErrors = await changeValidator(changes, elementsSource)
    })
    it('should not create errors', () => {
      expect(changeErrors).toBeEmpty()
    })
  })
})
