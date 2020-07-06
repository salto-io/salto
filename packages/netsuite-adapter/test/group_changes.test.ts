/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ChangeGroupId, ChangeId, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { getChangeGroupIds, SDF_CHANGE_GROUP_ID } from '../src/group_changes'
import { toChange } from './utils'
import { customTypes, fileCabinetTypes } from '../src/types'
import { ENTITY_CUSTOM_FIELD, FILE, NETSUITE } from '../src/constants'

describe('Group Changes', () => {
  const customFieldInstance = new InstanceElement('elementName',
    customTypes[ENTITY_CUSTOM_FIELD])

  const fileInstance = new InstanceElement('fileInstance', fileCabinetTypes[FILE])

  const dummyType = new ObjectType({ elemID: new ElemID(NETSUITE, 'dummytype') })
  const nonSdfInstance = new InstanceElement('nonSdfInstance', dummyType)
  let changeGroupIds: Map<ChangeId, ChangeGroupId>

  beforeAll(async () => {
    changeGroupIds = await getChangeGroupIds(new Map([
      [fileInstance.elemID.getFullName(), toChange({ after: fileInstance })],
      [customFieldInstance.elemID.getFullName(), toChange({ after: customFieldInstance })],
      [nonSdfInstance.elemID.getFullName(), toChange({ after: nonSdfInstance })],
      [dummyType.elemID.getFullName(), toChange({ after: dummyType })],
    ]))
  })

  it('should set correct group id for custom types instances', () => {
    expect(changeGroupIds.get(fileInstance.elemID.getFullName())).toEqual(SDF_CHANGE_GROUP_ID)
  })

  it('should set correct group id for file cabinet types instances', () => {
    expect(changeGroupIds.get(customFieldInstance.elemID.getFullName()))
      .toEqual(SDF_CHANGE_GROUP_ID)
  })

  it('should set correct group id for non SDF types instances', () => {
    expect(changeGroupIds.get(nonSdfInstance.elemID.getFullName()))
      .toEqual(nonSdfInstance.elemID.getFullName())
  })

  it('should set correct group id for non SDF types', () => {
    expect(changeGroupIds.get(dummyType.elemID.getFullName()))
      .toEqual(dummyType.elemID.getFullName())
  })
})
