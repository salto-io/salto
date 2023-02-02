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
import { Change, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { fileType } from '../../src/types/file_cabinet_types'
import { customsegmentType } from '../../src/autogen/types/standard_types/customsegment'
import { validateDependsOnInvalidElement } from '../../src/change_validators/dependencies'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, PATH, SCRIPT_ID } from '../../src/constants'

describe('Required Dependencies Validator', () => {
  const customsegment = customsegmentType().type
  let fileInstance: InstanceElement
  let customRecordType: ObjectType
  let customSegmentInstance: InstanceElement
  let dependsOn2Instances: InstanceElement
  let changes: ReadonlyArray<Change>
  beforeEach(() => {
    fileInstance = new InstanceElement('file_instance', fileType(), {
      [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
    })

    customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'custom_record_type'),
      annotations: {
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
        [SCRIPT_ID]: 'custom_record_type_script_id',
      },
    })

    customSegmentInstance = new InstanceElement('custom_segment_instance', customsegment, {
      [SCRIPT_ID]: 'custom_segment_instance_script_id',
    })

    customSegmentInstance.value.recordtype = new ReferenceExpression(
      customRecordType.elemID.createNestedID('attr', SCRIPT_ID), 'val', customRecordType
    )

    customRecordType.annotations.customsegment = new ReferenceExpression(
      customSegmentInstance.elemID.createNestedID(SCRIPT_ID),
      customSegmentInstance.value[SCRIPT_ID],
      customSegmentInstance
    )

    dependsOn2Instances = new InstanceElement('depends_on_2_instances', customsegment, {
      [SCRIPT_ID]: 'depends_on_2_instances_script_id',
      label: new ReferenceExpression(
        customSegmentInstance.elemID.createNestedID(SCRIPT_ID),
        customSegmentInstance.value[SCRIPT_ID],
        customSegmentInstance
      ),
      description: new ReferenceExpression(
        fileInstance.elemID.createNestedID(PATH),
        fileInstance.value[PATH],
        fileInstance
      ),
    })

    // dependsOn2Instances ---> customSegmentInstance <---> customRecordType
    //        |
    //        '--> fileInstance

    changes = [
      toChange({ before: dependsOn2Instances, after: dependsOn2Instances }),
      toChange({ before: customRecordType, after: customRecordType }),
      toChange({ after: customSegmentInstance }),
      toChange({ after: fileInstance }),
    ]
  })

  it('should return no change errors when there are no invalid elements from other change validators', async () => {
    expect(await validateDependsOnInvalidElement([], changes)).toEqual([])
  })

  it('should return no change errors if no other change depends on an invalid element', async () => {
    expect(await validateDependsOnInvalidElement(
      [dependsOn2Instances.elemID.getFullName(), fileInstance.elemID.getFullName()],
      changes
    )).toEqual([])
  })

  it('should return change errors for all changes that have dependency on an invalid element that was added', async () => {
    const changeErrors = await validateDependsOnInvalidElement([fileInstance.elemID.getFullName()], changes)
    expect(changeErrors)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          severity: 'Error',
          elemID: dependsOn2Instances.elemID,
        })]))
    expect(changeErrors).toHaveLength(1)
  })

  it('should return change errors for all changes that have required dependency on an invalid element (either added or required references), including deep dependency', async () => {
    const changeErrors = await validateDependsOnInvalidElement([customRecordType.elemID.getFullName()], changes)
    expect(changeErrors)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          severity: 'Error',
          elemID: customSegmentInstance.elemID,
        }),
        expect.objectContaining({
          severity: 'Error',
          elemID: dependsOn2Instances.elemID,
        })]))
    expect(changeErrors).toHaveLength(2)
  })
})
