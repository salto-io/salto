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
import { Change, BuiltinTypes, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { fileType } from '../../src/types/file_cabinet_types'
import { customsegmentType } from '../../src/autogen/types/standard_types/customsegment'
import { entitycustomfieldType } from '../../src/autogen/types/standard_types/entitycustomfield'
import { validateDependsOnInvalidElement } from '../../src/change_validators/dependencies'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, PATH, SCRIPT_ID } from '../../src/constants'

describe('2 -- Change Validator', () => {
  const customsegment = customsegmentType().type
  let customRecordType: ObjectType
  let customSegmentInstance: InstanceElement
  let customSegmentInstance222: InstanceElement
  let changes: ReadonlyArray<Change>
  beforeEach(() => {
    customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord_my_script_id'),
      annotations: {
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
        [SCRIPT_ID]: 'customrecord_my_script_id',
      },
    })

    customSegmentInstance222 = new InstanceElement('customSegmentInstance222',
      customsegment, {
        [SCRIPT_ID]: 'cseg_my_script_id',
      })

    customSegmentInstance = new InstanceElement('customSegmentInstance',
      customsegment, {
        [SCRIPT_ID]: 'cseg_my_script_id',
      })

    customSegmentInstance.value.recordtype = new ReferenceExpression(
      customRecordType.elemID, 'val', customRecordType
    )

    customRecordType.annotations.customsegment = new ReferenceExpression(
      customSegmentInstance222.elemID, 'val', customSegmentInstance222
    )

    changes = [
      toChange({ after: customSegmentInstance222 }),
      toChange({ after: customRecordType }),
      toChange({ after: customSegmentInstance })]
  })
  it('2 -- should return change errors for all changes that depend on an invalid element including deep dependency', async () => {
    expect(await validateDependsOnInvalidElement([customSegmentInstance222.elemID.getFullName()], changes))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          elemID: customRecordType.elemID,
        }),
        expect.objectContaining({
          elemID: customSegmentInstance.elemID,
        })]))
  })
})

describe('Change Validator', () => {
  const entitycustomfield = entitycustomfieldType().type
  const customFieldInstance = new InstanceElement('elementName',
    entitycustomfield, {
      label: 'elementName',
      [SCRIPT_ID]: 'custentity_my_script_id',
    })

  const fileInstance = new InstanceElement('fileInstance', fileType(), {
    [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
  })

  const dependsOn1Instance = new InstanceElement('dependsOn1Instance', entitycustomfield, {
    [SCRIPT_ID]: 'custentity_depends_on_1_instance',
    label: new ReferenceExpression(fileInstance.elemID.createNestedID(PATH),
      fileInstance.value[PATH], fileInstance),
  })

  const anotherAdapterInstance = new InstanceElement(
    'anotherAdapterInstance',
    new ObjectType({ elemID: new ElemID('another', 'type'),
      fields: {
        id: { refType: BuiltinTypes.SERVICE_ID },
      } }),
    { id: 'serviceIdValue' },
  )

  const instanceWithManyRefs = new InstanceElement('dependsOn2Instances', entitycustomfield, {
    [SCRIPT_ID]: 'custentity_depends_on_2',
    label: new ReferenceExpression(dependsOn1Instance.elemID.createNestedID(SCRIPT_ID),
      dependsOn1Instance.value[SCRIPT_ID], dependsOn1Instance),
    description: new ReferenceExpression(customFieldInstance.elemID.createNestedID('label'),
      customFieldInstance.value.label, customFieldInstance),
    help: new ReferenceExpression(anotherAdapterInstance.elemID.createNestedID('id'),
      anotherAdapterInstance.value.id, anotherAdapterInstance),
  })

  const changes = [toChange({ after: instanceWithManyRefs }),
    toChange({ after: dependsOn1Instance }),
    toChange({ after: fileInstance }),
    toChange({ after: customFieldInstance })]

  it('should return no change errors when there are no invalid elements from other change validators', async () => {
    expect(await validateDependsOnInvalidElement([], changes)).toEqual([])
  })

  it('should return no change errors if no other change depends on an invalid element', async () => {
    expect(
      await validateDependsOnInvalidElement(
        [instanceWithManyRefs.elemID.getFullName(), customFieldInstance.elemID.getFullName()],
        changes
      )
    ).toEqual([])
  })

  it('should return change errors for all changes that depend on an invalid element including deep dependency', async () => {
    expect(await validateDependsOnInvalidElement([fileInstance.elemID.getFullName()], changes))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          elemID: dependsOn1Instance.elemID,
        }),
        expect.objectContaining({
          elemID: instanceWithManyRefs.elemID,
        })]))
  })

  it('should return change error for change that depends on an invalid element', async () => {
    expect(
      await validateDependsOnInvalidElement([dependsOn1Instance.elemID.getFullName()], changes)
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({
        elemID: instanceWithManyRefs.elemID,
      })]))
  })
})
