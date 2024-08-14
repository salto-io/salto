/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  ChangeError,
  getChangeData,
  InstanceElement,
  ReadOnlyElementsSource,
  toChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { mockTypes } from '../mock_elements'
import { INSTANCE_FULL_NAME_FIELD } from '../../src/constants'
import changeValidator from '../../src/change_validators/last_layout_removal'

const { awu } = collections.asynciterable

describe('lastLayoutRemoval Change Validator', () => {
  const createLayoutInstance = (objectName: string, layoutName: string): InstanceElement =>
    new InstanceElement(layoutName, mockTypes.Layout, {
      [INSTANCE_FULL_NAME_FIELD]: `${objectName}-${layoutName}`,
    })

  const createMockElementsSource = (instances: InstanceElement[]): ReadOnlyElementsSource => ({
    getAll: async () => awu(instances),
    list: async () => awu([]),
    has: async () => true,
    get: async () => undefined,
  })

  let removedLayoutChanges: Change[]
  let changeErrors: readonly ChangeError[]

  beforeEach(() => {
    removedLayoutChanges = [
      createLayoutInstance('Account', 'AccountLayout1'),
      createLayoutInstance('Account', 'AccountLayout2'),
      createLayoutInstance('Account', 'AccountLayout3'),
      createLayoutInstance('Account', 'AccountLayout4'),
    ].map(instance => toChange({ before: instance }))
  })

  describe('when all layouts of Object are removed', () => {
    beforeEach(async () => {
      changeErrors = await changeValidator(removedLayoutChanges, createMockElementsSource([]))
    })
    it('should create change errors', () => {
      expect(changeErrors.map(error => error.elemID)).toEqual(
        removedLayoutChanges.map(getChangeData).map(instance => instance.elemID),
      )
    })
  })

  describe('when Object still has remaining Layouts', () => {
    beforeEach(async () => {
      changeErrors = await changeValidator(
        removedLayoutChanges,
        createMockElementsSource([createLayoutInstance('Account', 'remainingAccountLayout')]),
      )
    })
    it('should not create change errors', () => {
      expect(changeErrors).toBeEmpty()
    })
  })

  describe('when Object is removed with all of its layouts', () => {
    beforeEach(async () => {
      changeErrors = await changeValidator(
        [...removedLayoutChanges, toChange({ before: mockTypes.Account })],
        createMockElementsSource([]),
      )
    })
    it('should not create change errors', () => {
      expect(changeErrors).toBeEmpty()
    })
  })
})
