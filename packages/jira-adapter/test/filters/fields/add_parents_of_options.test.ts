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
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { JIRA } from '../../../src/constants'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, FIELD_CONTEXT_TYPE_NAME } from '../../../src/filters/fields/constants'
import addParentsOfOptionsFilter from '../../../src/filters/fields/add_parents_of_options'
import { getFilterParams } from '../../utils'

describe('add parents of options', () => {
  let contextType: ObjectType
  let optionType: ObjectType
  let contextInstance1: InstanceElement
  let contextInstance2: InstanceElement
  let optionInstance1: InstanceElement
  let filter: filterUtils.FilterWith<'preDeploy'>

  beforeEach(() => {
    contextType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME) })
    optionType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME) })
    contextInstance1 = new InstanceElement('context1', contextType, {})
    contextInstance2 = new InstanceElement('context2', contextType, {})
    optionInstance1 = new InstanceElement('option1', optionType, {})
    filter = addParentsOfOptionsFilter(getFilterParams()) as typeof filter
  })
  it('should not add changes if only context changes', async () => {
    const changes = [toChange({ before: contextInstance1, after: contextInstance1 })]
    await filter.preDeploy(changes)
    expect(changes.length).toEqual(1)
  })
  it('should not add changes if the parent of an option is already in the changes', async () => {
    optionInstance1.annotations[CORE_ANNOTATIONS.PARENT] = new ReferenceExpression(
      contextInstance1.elemID,
      contextInstance1,
      contextInstance1,
    )
    const changes = [
      toChange({ before: contextInstance1, after: contextInstance1 }),
      toChange({ before: optionInstance1, after: optionInstance1 }),
    ]
    await filter.preDeploy(changes)
    expect(changes.length).toEqual(2)
  })
  it('should add the parent of an option if the parent is not in the changes', async () => {
    optionInstance1.annotations[CORE_ANNOTATIONS.PARENT] = new ReferenceExpression(
      contextInstance1.elemID,
      contextInstance1,
      contextInstance1,
    )
    const changes = [
      toChange({ before: contextInstance2, after: contextInstance2 }),
      toChange({ before: optionInstance1, after: optionInstance1 }),
    ]
    await filter.preDeploy(changes)
    expect(changes.length).toEqual(3)
    expect(changes[2]).toEqual(toChange({ before: contextInstance1, after: contextInstance1 }))
  })
  it('should throw an error if there is no parent for an option', async () => {
    const changes = [toChange({ before: optionInstance1, after: optionInstance1 })]
    await expect(filter.preDeploy(changes)).rejects.toThrow(
      new Error('Expected jira.CustomFieldContextOption.instance.option1 to have exactly one parent, found 0'),
    )
  })
})
