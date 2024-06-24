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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { defaultAutomationRemovalValidator } from '../../src/change_validators'
import { AUTOMATION_TYPE_NAME, ZENDESK } from '../../src/constants'

describe('default automation removal change validator', () => {
  describe('when fetching instance changes', () => {
    const defaultAutomation = new InstanceElement(
      'default',
      new ObjectType({ elemID: new ElemID(ZENDESK, AUTOMATION_TYPE_NAME) }),
      { default: true },
    )
    const notDefaultAutomation = new InstanceElement(
      'notDefault',
      new ObjectType({ elemID: new ElemID(ZENDESK, AUTOMATION_TYPE_NAME) }),
      { default: false },
    )

    it('should have change error when default automation is removed', async () => {
      const changeErrors = await defaultAutomationRemovalValidator([toChange({ before: defaultAutomation })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors).toMatchObject([
        {
          elemID: defaultAutomation.elemID,
          severity: 'Warning',
          message: 'Cannot delete a default automation',
          detailedMessage:
            'The automation is a default automation in Zendesk, and cannot be removed on a production environment',
        },
      ])
    })

    it('should not have change error when non-default automation is removed', async () => {
      const changeErrors = await defaultAutomationRemovalValidator([toChange({ before: notDefaultAutomation })])
      expect(changeErrors).toHaveLength(0)
    })

    it('should not have change error when default automation is not removed', async () => {
      const changeErrors = await defaultAutomationRemovalValidator([
        toChange({ before: defaultAutomation, after: defaultAutomation }),
      ])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
