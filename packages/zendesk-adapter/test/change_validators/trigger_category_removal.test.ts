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
  InstanceElement,
  ObjectType,
  ElemID,
  toChange,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { elementSource as elementSourceUtils } from '@salto-io/workspace'
import { TRIGGER_TYPE_NAME, ZENDESK } from '../../src/constants'
import { triggerCategoryRemovalValidator } from '../../src/change_validators'
import { TRIGGER_CATEGORY_TYPE_NAME } from '../../src/filters/reorder/trigger'

const { createInMemoryElementSource } = elementSourceUtils

describe('triggerCategoryRemovalValidator', () => {
  let triggerCategoryWithoutTriggers: InstanceElement
  let triggerCategoryWithTriggers: InstanceElement
  let activeTriggerInstance: InstanceElement
  let inactiveTriggerInstance: InstanceElement
  beforeEach(() => {
    triggerCategoryWithTriggers = new InstanceElement(
      'withTriggers',
      new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_CATEGORY_TYPE_NAME) }),
      {}
    )
    const triggerCategoryRef = new ReferenceExpression(triggerCategoryWithTriggers.elemID)
    triggerCategoryWithoutTriggers = new InstanceElement(
      'withoutTriggers',
      new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_CATEGORY_TYPE_NAME) }),
      {}
    )
    activeTriggerInstance = new InstanceElement(
      'activeTrigger',
      new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) }),
      { active: true, category_id: triggerCategoryRef }
    )
    inactiveTriggerInstance = new InstanceElement(
      'inactiveTrigger',
      new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) }),
      { active: false, category_id: triggerCategoryRef }
    )
  })

  it('should error on removal of a trigger category with active trigger', async () => {
    const elementSource = createInMemoryElementSource([activeTriggerInstance])
    const changes = [toChange({ before: triggerCategoryWithTriggers })]
    const changeErrors = await triggerCategoryRemovalValidator(changes, elementSource)
    expect(changeErrors).toMatchObject([{
      elemID: triggerCategoryWithTriggers.elemID,
      severity: 'Error',
      message: 'Removal of trigger category with active triggers',
      detailedMessage: 'Trigger category is used by the following active triggers: [activeTrigger], please deactivate or remove them before removing the trigger category',
    }])
  })

  it('should error on warning of a trigger category with inactive trigger', async () => {
    const elementSource = createInMemoryElementSource([inactiveTriggerInstance])
    const changes = [toChange({ before: triggerCategoryWithTriggers })]
    const changeErrors = await triggerCategoryRemovalValidator(changes, elementSource)
    expect(changeErrors).toMatchObject([{
      elemID: triggerCategoryWithTriggers.elemID,
      severity: 'Warning',
      message: 'Removal of trigger category with inactive triggers',
      detailedMessage: 'Trigger category is used by the following inactive triggers: [inactiveTrigger], and they will be removed with the removal of this trigger category',
    }])
  })

  it('should not error on removal of a trigger category with no triggers', async () => {
    const elementSource = createInMemoryElementSource([
      activeTriggerInstance,
      inactiveTriggerInstance,
    ])
    const changes = [toChange({ before: triggerCategoryWithoutTriggers })]
    const changeErrors = await triggerCategoryRemovalValidator(changes, elementSource)
    expect(changeErrors).toMatchObject([])
  })

  it('should look at changed trigger instead of its elementSource instance', async () => {
    const changedActiveTrigger = activeTriggerInstance.clone()
    const changedInactiveTrigger = inactiveTriggerInstance.clone()
    changedActiveTrigger.value.active = false

    const elementSource = createInMemoryElementSource([
      activeTriggerInstance,
      inactiveTriggerInstance,
    ])
    const changes = [
      toChange({ before: triggerCategoryWithTriggers }),
      toChange({ before: activeTriggerInstance, after: changedActiveTrigger }),
      toChange({ before: changedInactiveTrigger }),
    ]
    const changeErrors = await triggerCategoryRemovalValidator(changes, elementSource)
    expect(changeErrors).toMatchObject([{
      elemID: triggerCategoryWithTriggers.elemID,
      severity: 'Warning',
      message: 'Removal of trigger category with inactive triggers',
      detailedMessage: 'Trigger category is used by the following inactive triggers: [activeTrigger], and they will be removed with the removal of this trigger category',
    }])
  })
})
