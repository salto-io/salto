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
import { filterUtils, references as referencesUtils } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, Value } from '@salto-io/adapter-api'
import sideConversationFilter from '../../src/filters/side_conversation'
import { createFilterCreatorParams } from '../utils'
import { GROUP_TYPE_NAME, MACRO_TYPE_NAME, TRIGGER_TYPE_NAME, ZENDESK } from '../../src/constants'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'

const { createMissingInstance } = referencesUtils

const groupType = new ObjectType({ elemID: new ElemID(ZENDESK, GROUP_TYPE_NAME) })
const triggerType = new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) })
const macroType = new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_TYPE_NAME) })

const createInstanceValue = (value: Value): Value => ({
  actions: [
    {
      field: 'side_conversation_ticket',
      value,
    },
  ],
})

describe('sideConversationFilter', () => {
  const filter = sideConversationFilter(createFilterCreatorParams({})) as filterUtils.FilterWith<'onFetch'>
  const group = new InstanceElement('group', groupType, { id: 123 })

  it('should replace group_id with reference expression', async () => {
    const instanceValue = createInstanceValue([
      'test',
      '<p>test</p>',
      'SupportAssignable:support_assignable/group/123',
      'text/htmll',
    ])
    const trigger = new InstanceElement('trigger', triggerType, instanceValue)
    const macro = new InstanceElement('macro', macroType, instanceValue)

    await filter.onFetch([group, trigger, macro])

    expect(trigger.value.actions[0].value[2]).toEqual({
      parts: ['SupportAssignable:support_assignable/group/', new ReferenceExpression(group.elemID, group)],
    })
    expect(macro.value.actions[0].value[2]).toEqual({
      parts: ['SupportAssignable:support_assignable/group/', new ReferenceExpression(group.elemID, group)],
    })
  })
  it('should replace group_id with missing reference when group does not exists', async () => {
    const instanceValue = createInstanceValue([
      'test',
      '<p>test</p>',
      'SupportAssignable:support_assignable/group/124+sufix',
      'text/htmll',
    ])
    const trigger = new InstanceElement('trigger', triggerType, instanceValue)
    const macro = new InstanceElement('macro', macroType, instanceValue)
    const missingGroup = createMissingInstance(ZENDESK, GROUP_TYPE_NAME, '124')
    missingGroup.value.id = '124'

    await filter.onFetch([group, trigger, macro])

    expect(trigger.value.actions[0].value[2]).toEqual({
      parts: [
        'SupportAssignable:support_assignable/group/',
        new ReferenceExpression(missingGroup.elemID, missingGroup),
        '+sufix',
      ],
    })
    expect(macro.value.actions[0].value[2]).toEqual({
      parts: [
        'SupportAssignable:support_assignable/group/',
        new ReferenceExpression(missingGroup.elemID, missingGroup),
        '+sufix',
      ],
    })
  })
  it('should not replace group_id with missing reference when group does not exists but enableMissingReference is false', async () => {
    const config = { ...DEFAULT_CONFIG }
    config[FETCH_CONFIG].enableMissingReferences = false
    const filterWithoutMissingReference = sideConversationFilter(
      createFilterCreatorParams({ config }),
    ) as filterUtils.FilterWith<'onFetch'>
    const instanceValue = createInstanceValue([
      'test',
      '<p>test</p>',
      'SupportAssignable:support_assignable/group/124+sufix',
      'text/htmll',
    ])
    const trigger = new InstanceElement('trigger', triggerType, instanceValue)
    const macro = new InstanceElement('macro', macroType, instanceValue)

    await filterWithoutMissingReference.onFetch([group, trigger, macro])

    expect(trigger.value.actions[0].value[2]).toEqual('SupportAssignable:support_assignable/group/124+sufix')
    expect(macro.value.actions[0].value[2]).toEqual('SupportAssignable:support_assignable/group/124+sufix')
  })
  it('should do nothing on incorrect string of the group', async () => {
    const instanceValue = createInstanceValue(['test', '<p>test</p>', 'incorrectString', 'text/htmll'])
    const trigger = new InstanceElement('trigger', triggerType, instanceValue)
    const macro = new InstanceElement('macro', macroType, instanceValue)

    await filter.onFetch([group, trigger, macro])

    expect(trigger.value.actions[0].value[2]).toEqual('incorrectString')
    expect(macro.value.actions[0].value[2]).toEqual('incorrectString')
  })
  it('should do nothing and not crash on bad format of action', async () => {
    const instanceValue1 = createInstanceValue([1, 2])
    const instanceValue2 = createInstanceValue('test')
    const trigger = new InstanceElement('trigger', triggerType, instanceValue1)
    const macro = new InstanceElement('macro', macroType, instanceValue2)

    await filter.onFetch([group, trigger, macro])

    expect(trigger.value.actions[0].value).toEqual([1, 2])
    expect(macro.value.actions[0].value).toEqual('test')
  })
})
