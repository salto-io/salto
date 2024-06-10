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

import { Change, ChangeGroup, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ADAPTER_NAME } from '../src/constants'

export const objectTypeMock = new ObjectType({
  elemID: new ElemID(ADAPTER_NAME, 'testType'),
})

export const instanceElementMock = new InstanceElement('testInstance', objectTypeMock, {
  testField: 'testValue',
})

export const additionChangeMock: Change<InstanceElement> = toChange({
  after: instanceElementMock,
})

export const changeGroupMock: ChangeGroup = {
  groupID: 'testGroup',
  changes: [additionChangeMock],
}

export const mockElementSource = buildElementsSourceFromElements([objectTypeMock, instanceElementMock])

export const contextMock: definitions.deploy.ChangeAndContext & definitions.ContextParams = {
  additionalContext: { parent_id: 'parent_id' },
  change: additionChangeMock,
  changeGroup: changeGroupMock,
  elementSource: mockElementSource,
  sharedContext: {},
}
