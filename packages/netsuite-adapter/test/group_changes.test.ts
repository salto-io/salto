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
import { ChangeGroupId, ChangeId, ElemID, InstanceElement, ObjectType, toChange, Change, StaticFile, ReferenceExpression, BuiltinTypes } from '@salto-io/adapter-api'
import { getChangeGroupIdsFunc, SDF_CREATE_OR_UPDATE_GROUP_ID, SUITEAPP_CREATING_FILES_GROUP_ID, SUITEAPP_CREATING_RECORDS_GROUP_ID, SUITEAPP_DELETING_FILES_GROUP_ID, SUITEAPP_DELETING_RECORDS_GROUP_ID, SDF_DELETE_GROUP_ID, SUITEAPP_UPDATING_CONFIG_GROUP_ID, SUITEAPP_UPDATING_FILES_GROUP_ID, SUITEAPP_UPDATING_RECORDS_GROUP_ID } from '../src/group_changes'
import { APPLICATION_ID, CUSTOM_RECORD_TYPE, INTERNAL_ID, METADATA_TYPE, NETSUITE } from '../src/constants'
import { entitycustomfieldType } from '../src/autogen/types/standard_types/entitycustomfield'
import { fileType } from '../src/types/file_cabinet_types'
import { SUITEAPP_CONFIG_TYPE_NAMES } from '../src/types'

describe('Group Changes without Salto suiteApp', () => {
  const entitycustomfield = entitycustomfieldType().type
  const file = fileType()

  const customFieldInstance = new InstanceElement('elementName',
    entitycustomfield)

  const customFieldFromSuiteAppInstance = new InstanceElement(
    'elementNameFromSuiteApp',
    entitycustomfield,
    { [APPLICATION_ID]: 'a.b.c' },
  )

  const customRecordTypeFromSuiteApp = new ObjectType({
    elemID: new ElemID(NETSUITE, 'customrecord1'),
    fields: {
      custom_field: { refType: BuiltinTypes.STRING },
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      [APPLICATION_ID]: 'a.b.c',
    },
  })

  const fileInstance = new InstanceElement(
    'fileInstance',
    file,
    { path: '/SuiteScripts/a.txt' }
  )

  const nonSdfFileInstance = new InstanceElement(
    'fileInstance2',
    file,
    { path: '/not/allowed/path' }
  )

  const dummyType = new ObjectType({ elemID: new ElemID(NETSUITE, 'dummytype') })
  const nonSdfInstance = new InstanceElement('nonSdfInstance', dummyType)
  let changeGroupIds: Map<ChangeId, ChangeGroupId>

  beforeAll(async () => {
    changeGroupIds = (await getChangeGroupIdsFunc(false)(new Map<string, Change>([
      [fileInstance.elemID.getFullName(), toChange({ after: fileInstance })],
      [customFieldInstance.elemID.getFullName(), toChange({ after: customFieldInstance })],
      [
        customFieldFromSuiteAppInstance.elemID.getFullName(),
        toChange({ after: customFieldFromSuiteAppInstance }),
      ],
      [
        customRecordTypeFromSuiteApp.elemID.getFullName(),
        toChange({ after: customRecordTypeFromSuiteApp }),
      ],
      [
        customRecordTypeFromSuiteApp.fields.custom_field.elemID.getFullName(),
        toChange({ after: customRecordTypeFromSuiteApp.fields.custom_field }),
      ],
      [nonSdfInstance.elemID.getFullName(), toChange({ after: nonSdfInstance })],
      [dummyType.elemID.getFullName(), toChange({ after: dummyType })],
      [nonSdfFileInstance.elemID.getFullName(), toChange({ after: nonSdfFileInstance })],
    ]))).changeGroupIdMap
  })

  it('should set correct group id for custom types instances', () => {
    expect(changeGroupIds.get(customFieldInstance.elemID.getFullName()))
      .toEqual(SDF_CREATE_OR_UPDATE_GROUP_ID)
  })

  it('should set correct group id for custom types elements from suiteapps', () => {
    expect(changeGroupIds.get(customFieldFromSuiteAppInstance.elemID.getFullName()))
      .toEqual(`${SDF_CREATE_OR_UPDATE_GROUP_ID} - a.b.c`)
    expect(changeGroupIds.get(customRecordTypeFromSuiteApp.elemID.getFullName()))
      .toEqual(`${SDF_CREATE_OR_UPDATE_GROUP_ID} - a.b.c`)
    expect(changeGroupIds.get(
      customRecordTypeFromSuiteApp.fields.custom_field.elemID.getFullName()
    )).toEqual(`${SDF_CREATE_OR_UPDATE_GROUP_ID} - a.b.c`)
  })

  it('should set correct group id for file cabinet types instances', () => {
    expect(changeGroupIds.get(fileInstance.elemID.getFullName())).toEqual(SDF_CREATE_OR_UPDATE_GROUP_ID)
  })

  it('should not set group id for non SDF types instances', () => {
    expect(changeGroupIds.has(nonSdfInstance.elemID.getFullName())).toBe(false)
  })

  it('should not set group id for non SDF types', () => {
    expect(changeGroupIds.has(dummyType.elemID.getFullName())).toBe(false)
  })

  it('should not set group id for FileCabinet instances in non-allowed paths', () => {
    expect(changeGroupIds.has(nonSdfFileInstance.elemID.getFullName())).toBe(false)
  })
})

describe('Group Changes with Salto suiteApp', () => {
  const entitycustomfield = entitycustomfieldType().type
  const file = fileType()

  const customFieldInstance = new InstanceElement('elementName',
    entitycustomfield)
  const customFieldFromSuiteAppInstance = new InstanceElement(
    'elementNameFromSuiteApp',
    entitycustomfield,
    { [APPLICATION_ID]: 'a.b.c' },
  )
  const dummyType = new ObjectType({ elemID: new ElemID(NETSUITE, 'dummytype') })
  const nonSdfInstance = new InstanceElement('nonSdfInstance', dummyType)

  const suiteAppFileInstance1 = new InstanceElement(
    'fileInstance',
    file,
    {
      path: '/Images/file',
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    }
  )

  const suiteAppFileInstance2 = new InstanceElement(
    'fileInstance2',
    file,
    {
      path: '/Templates/file',
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    }
  )

  const suiteAppFileInstance3Before = new InstanceElement(
    'fileInstance3',
    file,
    {
      path: '/Images/file3',
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    }
  )

  const suiteAppFileInstance3After = new InstanceElement(
    'fileInstance3',
    file,
    {
      path: '/Images/file3',
      description: 'aa',
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    }
  )

  const deletedSuiteAppFileInstance = new InstanceElement(
    'deletedInstance4',
    file,
    {
      path: '/Images/file4',
      description: 'aa',
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    }
  )

  const sdfFileInstance1 = new InstanceElement(
    'fileInstance4',
    file,
    {
      path: '/Templates/file',
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('a'.repeat(11 * 1024 * 1024)) }),
    }
  )
  const sdfFileInstance2 = new InstanceElement(
    'fileInstance5',
    file,
    {
      path: '/Templates/file',
      generateurltimestamp: true,
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    }
  )

  const subsidiaryType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'subsidiary'),
    annotations: { source: 'soap' },
  })

  const newDataInstance1 = new InstanceElement(
    'newDataInstance1',
    subsidiaryType,
  )
  const newDataInstance2 = new InstanceElement(
    'newDataInstance2',
    subsidiaryType,
  )
  const newDataInstance3 = new InstanceElement(
    'newDataInstance3',
    subsidiaryType,
    { value: new ReferenceExpression(newDataInstance1.elemID) },
  )
  const newDataInstance4 = new InstanceElement(
    'newDataInstance3',
    subsidiaryType,
    { value: new ReferenceExpression(newDataInstance2.elemID) },
  )

  const modifiedDataInstance = new InstanceElement(
    'modifiedDataInstance',
    subsidiaryType,
  )

  const deletedDataInstance = new InstanceElement(
    'deletedDataInstance',
    subsidiaryType,
  )

  const deletedCustomRecordType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'customrecord1'),
    annotations: { [METADATA_TYPE]: CUSTOM_RECORD_TYPE, [INTERNAL_ID]: '1' },
  })

  const deletedStandardInstance = new InstanceElement('test', entitycustomfieldType().type, { [INTERNAL_ID]: '11' })

  const configType = new ObjectType({
    elemID: new ElemID(NETSUITE, SUITEAPP_CONFIG_TYPE_NAMES[0]),
  })

  const configInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    configType,
  )

  let changeGroupIds: Map<ChangeId, ChangeGroupId>


  beforeAll(async () => {
    changeGroupIds = (await getChangeGroupIdsFunc(true)(new Map<string, Change>([
      [customFieldInstance.elemID.getFullName(), toChange({ after: customFieldInstance })],
      [
        customFieldFromSuiteAppInstance.elemID.getFullName(),
        toChange({ after: customFieldFromSuiteAppInstance }),
      ],
      [nonSdfInstance.elemID.getFullName(), toChange({ after: nonSdfInstance })],
      [dummyType.elemID.getFullName(), toChange({ after: dummyType })],
      [suiteAppFileInstance1.elemID.getFullName(), toChange({ after: suiteAppFileInstance1 })],
      [suiteAppFileInstance2.elemID.getFullName(), toChange({ after: suiteAppFileInstance2 })],
      [
        suiteAppFileInstance3Before.elemID.getFullName(),
        toChange({ before: suiteAppFileInstance3Before, after: suiteAppFileInstance3After }),
      ],
      [
        deletedSuiteAppFileInstance.elemID.getFullName(),
        toChange({ before: deletedSuiteAppFileInstance }),
      ],
      [sdfFileInstance1.elemID.getFullName(), toChange({ after: sdfFileInstance1 })],
      [sdfFileInstance2.elemID.getFullName(), toChange({ after: sdfFileInstance2 })],
      [newDataInstance1.elemID.getFullName(), toChange({ after: newDataInstance1 })],
      [newDataInstance2.elemID.getFullName(), toChange({ after: newDataInstance2 })],
      [newDataInstance3.elemID.getFullName(), toChange({ after: newDataInstance3 })],
      [newDataInstance4.elemID.getFullName(), toChange({ after: newDataInstance4 })],
      [modifiedDataInstance.elemID.getFullName(), toChange({
        before: modifiedDataInstance,
        after: modifiedDataInstance,
      })],
      [deletedDataInstance.elemID.getFullName(), toChange({ before: deletedDataInstance })],
      [configInstance.elemID.getFullName(), toChange({ after: configInstance })],
      [deletedCustomRecordType.elemID.getFullName(), toChange({ before: deletedCustomRecordType })],
      [deletedStandardInstance.elemID.getFullName(), toChange({ before: deletedStandardInstance })],
    ]))).changeGroupIdMap
  })

  it('should set correct group id for custom types instances', () => {
    expect(changeGroupIds.get(customFieldInstance.elemID.getFullName()))
      .toEqual(SDF_CREATE_OR_UPDATE_GROUP_ID)
  })

  it('should set correct group id for custom types instances from suiteapps', () => {
    expect(changeGroupIds.get(customFieldFromSuiteAppInstance.elemID.getFullName()))
      .toEqual(`${SDF_CREATE_OR_UPDATE_GROUP_ID} - a.b.c`)
  })

  it('should set correct group id for new suiteApp file instances', () => {
    expect(changeGroupIds.get(suiteAppFileInstance1.elemID.getFullName()))
      .toEqual(SUITEAPP_CREATING_FILES_GROUP_ID)

    expect(changeGroupIds.get(suiteAppFileInstance2.elemID.getFullName()))
      .toEqual(SUITEAPP_CREATING_FILES_GROUP_ID)
  })

  it('should set correct group id for existing suiteApp file instances', () => {
    expect(changeGroupIds.get(suiteAppFileInstance3Before.elemID.getFullName()))
      .toEqual(SUITEAPP_UPDATING_FILES_GROUP_ID)
  })

  it('should set correct group id for removed suiteApp file instances', () => {
    expect(changeGroupIds.get(deletedSuiteAppFileInstance.elemID.getFullName()))
      .toEqual(SUITEAPP_DELETING_FILES_GROUP_ID)
  })

  it('should set correct group id for SDF file instances', () => {
    expect(changeGroupIds.get(sdfFileInstance1.elemID.getFullName()))
      .toEqual(SDF_CREATE_OR_UPDATE_GROUP_ID)

    expect(changeGroupIds.get(sdfFileInstance2.elemID.getFullName()))
      .toEqual(SDF_CREATE_OR_UPDATE_GROUP_ID)
  })

  it('should set correct group id for data instances', () => {
    expect(changeGroupIds.get(newDataInstance1.elemID.getFullName()))
      .toEqual(`${SUITEAPP_CREATING_RECORDS_GROUP_ID} - 1/2`)

    expect(changeGroupIds.get(newDataInstance2.elemID.getFullName()))
      .toEqual(`${SUITEAPP_CREATING_RECORDS_GROUP_ID} - 1/2`)

    expect(changeGroupIds.get(newDataInstance3.elemID.getFullName()))
      .toEqual(`${SUITEAPP_CREATING_RECORDS_GROUP_ID} - 2/2`)

    expect(changeGroupIds.get(newDataInstance4.elemID.getFullName()))
      .toEqual(`${SUITEAPP_CREATING_RECORDS_GROUP_ID} - 2/2`)

    expect(changeGroupIds.get(modifiedDataInstance.elemID.getFullName()))
      .toEqual(SUITEAPP_UPDATING_RECORDS_GROUP_ID)

    expect(changeGroupIds.get(deletedDataInstance.elemID.getFullName()))
      .toEqual(SUITEAPP_DELETING_RECORDS_GROUP_ID)
  })

  it('should set correct group id for config instances', () => {
    expect(changeGroupIds.get(configInstance.elemID.getFullName()))
      .toEqual(SUITEAPP_UPDATING_CONFIG_GROUP_ID)
  })

  it('should not set group id for non SDF types instances', () => {
    expect(changeGroupIds.has(nonSdfInstance.elemID.getFullName())).toBe(false)
  })

  it('should set correct group id for custom record type', () => {
    expect(changeGroupIds.get(deletedCustomRecordType.elemID.getFullName()))
      .toEqual(SDF_DELETE_GROUP_ID)
  })

  it('should set correct group id for instance with non custom object type', () => {
    expect(changeGroupIds.get(deletedStandardInstance.elemID.getFullName()))
      .toEqual(SDF_DELETE_GROUP_ID)
  })
})
