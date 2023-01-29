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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { fileType } from '../../src/types/file_cabinet_types'
import { customsegmentType } from '../../src/autogen/types/standard_types/customsegment'
import extraReferenceDependenciesValidator from '../../src/change_validators/extra_reference_dependencies'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, PATH, SCRIPT_ID } from '../../src/constants'


describe('extra reference changes', () => {
  const customsegment = customsegmentType().type

  const fileInstance = new InstanceElement('file_instance', fileType(), {
    [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
  })

  const customRecordType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'custom_record_type'),
    annotations: {
      [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      [SCRIPT_ID]: 'custom_record_type_script_id',
    },
  })

  const customSegmentInstance = new InstanceElement('custom_segment_instance', customsegment, {
    [SCRIPT_ID]: 'custom_segment_instance_script_id',
    description: new ReferenceExpression(
      fileInstance.elemID.createNestedID(PATH),
      fileInstance.value[PATH],
      fileInstance
    ),
  })

  customSegmentInstance.value.recordtype = new ReferenceExpression(
    customRecordType.elemID.createNestedID('attr', SCRIPT_ID), 'val', customRecordType
  )

  customRecordType.annotations.customsegment = new ReferenceExpression(
    customSegmentInstance.elemID.createNestedID(SCRIPT_ID),
    customSegmentInstance.value[SCRIPT_ID],
    customSegmentInstance
  )

  const dependsOn2Instances = new InstanceElement('depends_on_2_instances', customsegment, {
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
  //        |                     |
  //        '-->  fileInstance <--'

  it('should not have ChangeError when deploying an instance with its dependencies, when requesting to add only required references', async () => {
    const changeErrors = await extraReferenceDependenciesValidator([
      toChange({ before: customRecordType, after: customRecordType }),
      toChange({ after: customSegmentInstance }),
      toChange({ before: fileInstance, after: fileInstance }),
    ], false)
    expect(changeErrors).toHaveLength(0)
  })

  it('should not have ChangeError when deploying an instance with its dependencies, when requesting to add all references', async () => {
    const changeErrors = await extraReferenceDependenciesValidator([
      toChange({ before: customRecordType, after: customRecordType }),
      toChange({ after: customSegmentInstance }),
      toChange({ before: fileInstance, after: fileInstance }),
    ], true)
    expect(changeErrors).toHaveLength(0)
  })

  it('should have Warning ChangeError when deploying an instance without its required reference, when requesting to add only required references', async () => {
    const changeErrors = await extraReferenceDependenciesValidator([
      toChange({ after: customSegmentInstance }),
      toChange({ before: dependsOn2Instances, after: dependsOn2Instances }),
    ], false)
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          severity: 'Warning',
          elemID: customSegmentInstance.elemID,
          message: expect.stringMatching('This element requires additional element to be deployed. Salto will automatically deploy it'), // check singular inflection
          detailedMessage: expect.stringMatching(customRecordType.elemID.getFullName()),
        })]))
  })

  it('should have Warning ChangeErrors when deploying a instances without their dependencies, each instance with its relevant references', async () => {
    const changeErrors = await extraReferenceDependenciesValidator([
      toChange({ after: customRecordType }),
      toChange({ before: dependsOn2Instances, after: dependsOn2Instances }),
    ], true)
    expect(changeErrors).toHaveLength(2)
    const customSegmentInstanceElemId = customSegmentInstance.elemID.getFullName()
    const fileInstanceElemId = fileInstance.elemID.getFullName()
    const missingReferences = `(.*${customSegmentInstanceElemId}, ${fileInstanceElemId}.*)|(.*${fileInstanceElemId}, ${customSegmentInstanceElemId}.*)`
    expect(changeErrors)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          severity: 'Warning',
          elemID: customRecordType.elemID,
          message: expect.stringMatching('This element requires additional elements to be deployed. Salto will automatically deploy them'), // check plural inflection
          detailedMessage: expect.stringMatching(missingReferences),
        }),
        expect.objectContaining({
          severity: 'Warning',
          elemID: dependsOn2Instances.elemID,
          message: expect.stringMatching('This element requires additional elements to be deployed. Salto will automatically deploy them'), // check plural inflection
          detailedMessage: expect.stringMatching(missingReferences),
        })]))
  })
})
