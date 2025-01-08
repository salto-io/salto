/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  }: CreateDuplicateRuleInstanceParams): InstanceElement =>
    new InstanceElement(instanceName, mockTypes.DuplicateRule, {
      [INSTANCE_FULL_NAME_FIELD]: `${objectName}.${instanceName}`,
      sortOrder,
    })

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
      const allInstances = [...existingDuplicateRuleInstances, ...changedInstances]
      const elementsSource = createMockElementsSource(allInstances)
      changeErrors = await changeValidator(changes, elementsSource)
    })
    it('should create errors', () => {
      expect(changeErrors.map(error => error.elemID)).toEqual(changedInstances.map(instance => instance.elemID))
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
        createDuplicateRuleInstance({
          instanceName: 'existingDuplicateRule3',
          objectName: MODIFICATION_OBJECT_NAME,
          sortOrder: 3,
        }),
        createDuplicateRuleInstance({
          instanceName: 'existingDuplicateRule4',
          objectName: MODIFICATION_OBJECT_NAME,
          sortOrder: 4,
        }),
        createDuplicateRuleInstance({
          instanceName: 'existingDuplicateRule5',
          objectName: MODIFICATION_OBJECT_NAME,
          sortOrder: 5,
        }),
        createDuplicateRuleInstance({
          instanceName: 'existingDuplicateRule6',
          objectName: MODIFICATION_OBJECT_NAME,
          sortOrder: 6,
        }),
        createDuplicateRuleInstance({
          instanceName: 'existingDuplicateRule7',
          objectName: MODIFICATION_OBJECT_NAME,
          sortOrder: 7,
        }),
        createDuplicateRuleInstance({
          instanceName: 'existingDuplicateRule8',
          objectName: MODIFICATION_OBJECT_NAME,
          sortOrder: 8,
        }),
        createDuplicateRuleInstance({
          instanceName: 'existingDuplicateRule9',
          objectName: MODIFICATION_OBJECT_NAME,
          sortOrder: 9,
        }),
        createDuplicateRuleInstance({
          instanceName: 'existingDuplicateRule10',
          objectName: MODIFICATION_OBJECT_NAME,
          sortOrder: 10,
        }),
        createDuplicateRuleInstance({
          instanceName: 'existingDuplicateRule11',
          objectName: MODIFICATION_OBJECT_NAME,
          sortOrder: 11,
        }),
        createDuplicateRuleInstance({
          instanceName: 'existingDuplicateRule12',
          objectName: MODIFICATION_OBJECT_NAME,
          sortOrder: 12,
        }),
      ]
      const changes = [additionChange, modificationChange]
      changedInstances = changes.map(getChangeData)
      const allInstances = [...existingDuplicateRuleInstances, ...changedInstances]
      const elementsSource = createMockElementsSource(allInstances)
      changeErrors = await changeValidator(changes, elementsSource)
    })
    it('should not create errors', () => {
      expect(changeErrors).toBeEmpty()
    })
  })
})
