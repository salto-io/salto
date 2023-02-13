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
  const createLayoutInstance = (objectName: string, layoutName: string): InstanceElement => (
    new InstanceElement(
      layoutName,
      mockTypes.Layout,
      {
        [INSTANCE_FULL_NAME_FIELD]: `${objectName}-${layoutName}`,
      },
    )
  )

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
      changeErrors = await changeValidator(
        removedLayoutChanges,
        createMockElementsSource([]),
      )
    })
    it('should create change errors', () => {
      expect(changeErrors.map(error => error.elemID))
        .toEqual(removedLayoutChanges.map(getChangeData).map(instance => instance.elemID))
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
