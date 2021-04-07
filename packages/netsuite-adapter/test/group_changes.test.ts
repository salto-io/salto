/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ChangeGroupId, ChangeId, ElemID, InstanceElement, ObjectType, toChange, Change, StaticFile } from '@salto-io/adapter-api'
import { getChangeGroupIdsFunc, SDF_CHANGE_GROUP_ID } from '../src/group_changes'
import { customTypes, fileCabinetTypes } from '../src/types'
import { ENTITY_CUSTOM_FIELD, FILE, NETSUITE } from '../src/constants'

describe('Group Changes without Salto suiteApp', () => {
  const customFieldInstance = new InstanceElement('elementName',
    customTypes[ENTITY_CUSTOM_FIELD])

  const fileInstance = new InstanceElement('fileInstance', fileCabinetTypes[FILE])

  const dummyType = new ObjectType({ elemID: new ElemID(NETSUITE, 'dummytype') })
  const nonSdfInstance = new InstanceElement('nonSdfInstance', dummyType)
  let changeGroupIds: Map<ChangeId, ChangeGroupId>

  beforeAll(async () => {
    changeGroupIds = await getChangeGroupIdsFunc(false)(new Map<string, Change>([
      [fileInstance.elemID.getFullName(), toChange({ after: fileInstance })],
      [customFieldInstance.elemID.getFullName(), toChange({ after: customFieldInstance })],
      [nonSdfInstance.elemID.getFullName(), toChange({ after: nonSdfInstance })],
      [dummyType.elemID.getFullName(), toChange({ after: dummyType })],
    ]))
  })

  it('should set correct group id for custom types instances', () => {
    expect(changeGroupIds.get(customFieldInstance.elemID.getFullName()))
      .toEqual(SDF_CHANGE_GROUP_ID)
  })

  it('should set correct group id for file cabinet types instances', () => {
    expect(changeGroupIds.get(fileInstance.elemID.getFullName())).toEqual(SDF_CHANGE_GROUP_ID)
  })

  it('should not set group id for non SDF types instances', () => {
    expect(changeGroupIds.has(nonSdfInstance.elemID.getFullName())).toBe(false)
  })

  it('should not set group id for non SDF types', () => {
    expect(changeGroupIds.has(dummyType.elemID.getFullName())).toBe(false)
  })
})

describe('Group Changes with Salto suiteApp', () => {
  const customFieldInstance = new InstanceElement('elementName',
    customTypes[ENTITY_CUSTOM_FIELD])
  const dummyType = new ObjectType({ elemID: new ElemID(NETSUITE, 'dummytype') })
  const nonSdfInstance = new InstanceElement('nonSdfInstance', dummyType)

  const suiteAppFileInstance1 = new InstanceElement(
    'fileInstance',
    fileCabinetTypes[FILE],
    {
      path: '/Images/file',
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    }
  )

  const suiteAppFileInstance2 = new InstanceElement(
    'fileInstance2',
    fileCabinetTypes[FILE],
    {
      path: '/Templates/file',
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    }
  )

  const suiteAppFileInstance3Before = new InstanceElement(
    'fileInstance3',
    fileCabinetTypes[FILE],
    {
      path: '/Images/file3',
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    }
  )

  const suiteAppFileInstance3After = new InstanceElement(
    'fileInstance3',
    fileCabinetTypes[FILE],
    {
      path: '/Images/file3',
      description: 'aa',
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    }
  )

  const sdfFileInstance1 = new InstanceElement(
    'fileInstance4',
    fileCabinetTypes[FILE],
    {
      path: '/Templates/file',
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('a'.repeat(11 * 1024 * 1024)) }),
    }
  )
  const sdfFileInstance2 = new InstanceElement(
    'fileInstance5',
    fileCabinetTypes[FILE],
    {
      path: '/Templates/file',
      generateurltimestamp: true,
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    }
  )

  let changeGroupIds: Map<ChangeId, ChangeGroupId>


  beforeAll(async () => {
    changeGroupIds = await getChangeGroupIdsFunc(true)(new Map<string, Change>([
      [customFieldInstance.elemID.getFullName(), toChange({ after: customFieldInstance })],
      [nonSdfInstance.elemID.getFullName(), toChange({ after: nonSdfInstance })],
      [dummyType.elemID.getFullName(), toChange({ after: dummyType })],
      [suiteAppFileInstance1.elemID.getFullName(), toChange({ after: suiteAppFileInstance1 })],
      [suiteAppFileInstance2.elemID.getFullName(), toChange({ after: suiteAppFileInstance2 })],
      [
        suiteAppFileInstance3Before.elemID.getFullName(),
        toChange({ before: suiteAppFileInstance3Before, after: suiteAppFileInstance3After }),
      ],
      [sdfFileInstance1.elemID.getFullName(), toChange({ after: sdfFileInstance1 })],
      [sdfFileInstance2.elemID.getFullName(), toChange({ after: sdfFileInstance2 })],
    ]))
  })

  it('should set correct group id for custom types instances', () => {
    expect(changeGroupIds.get(customFieldInstance.elemID.getFullName()))
      .toEqual('Records')
  })

  it('should set correct group id for new suiteApp file instances', () => {
    expect(changeGroupIds.get(suiteAppFileInstance1.elemID.getFullName()))
      .toEqual('Salto SuiteApp - File Cabinet - Creating Files')

    expect(changeGroupIds.get(suiteAppFileInstance2.elemID.getFullName()))
      .toEqual('Salto SuiteApp - File Cabinet - Creating Files')
  })

  it('should set correct group id for existing suiteApp file instances', () => {
    expect(changeGroupIds.get(suiteAppFileInstance3Before.elemID.getFullName()))
      .toEqual('Salto SuiteApp - File Cabinet - Updating Files')
  })

  it('should set correct group id for SDF file instances', () => {
    expect(changeGroupIds.get(sdfFileInstance1.elemID.getFullName()))
      .toEqual('SDF - File Cabinet')

    expect(changeGroupIds.get(sdfFileInstance2.elemID.getFullName()))
      .toEqual('SDF - File Cabinet')
  })

  it('should not set group id for non SDF types instances', () => {
    expect(changeGroupIds.has(nonSdfInstance.elemID.getFullName())).toBe(false)
  })

  it('should not set group id for non SDF types', () => {
    expect(changeGroupIds.has(dummyType.elemID.getFullName())).toBe(false)
  })
})
