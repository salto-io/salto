/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, ReferenceExpression, StaticFile } from '@salto-io/adapter-api'
import { customrecordtypeType } from '../src/autogen/types/standard_types/customrecordtype'
import { customsegmentType } from '../src/autogen/types/standard_types/customsegment'
import { datasetType } from '../src/autogen/types/standard_types/dataset'
import { entitycustomfieldType } from '../src/autogen/types/standard_types/entitycustomfield'
import { workbookType } from '../src/autogen/types/standard_types/workbook'
import { fileType } from '../src/types/file_cabinet_types'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, PATH, SCRIPT_ID } from '../src/constants'
import { getReferencedElements } from '../src/reference_dependencies'

describe('reference dependencies', () => {
  const entitycustomfield = entitycustomfieldType().type
  const customrecordtype = customrecordtypeType().type
  const customsegment = customsegmentType().type
  const dataset = datasetType().type
  const workbook = workbookType().type

  const fileInstance = new InstanceElement('fileInstance', fileType(), {
    [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
  })

  const dependsOn1Instance = new InstanceElement('dependsOn1Instance', entitycustomfield, {
    [SCRIPT_ID]: 'custentity_depends_on_1_instance',
    label: new ReferenceExpression(fileInstance.elemID.createNestedID(PATH),
      fileInstance.value[PATH], fileInstance),
  })

  const instance = new InstanceElement('elementName',
    entitycustomfield, {
      label: 'elementName',
      [SCRIPT_ID]: 'custentity_my_script_id',
      description: new StaticFile({
        filepath: 'netsuite/elementName.suffix',
        content: Buffer.from('description value'),
      }),
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
    description: new ReferenceExpression(instance.elemID.createNestedID('label'),
      instance.value.label, instance),
    help: new ReferenceExpression(anotherAdapterInstance.elemID.createNestedID('id'),
      anotherAdapterInstance.value.id, anotherAdapterInstance),
  })

  describe('getAllReferencedInstances', () => {
    it('should return all depending instances', async () => {
      const result = await getReferencedElements([instanceWithManyRefs], true)
      expect(result).toEqual([instanceWithManyRefs, dependsOn1Instance, fileInstance])
    })
  })
  describe('getRequiredReferencedInstances', () => {
    const customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord_my_script_id'),
      annotations: {
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
        [SCRIPT_ID]: 'customrecord_my_script_id',
      },
    })

    const customSegmentInstance = new InstanceElement('customSegmentInstance',
      customsegment, {
        [SCRIPT_ID]: 'cseg_my_script_id',
      })

    customSegmentInstance.value.recordtype = new ReferenceExpression(
      customRecordType.elemID, 'val', customRecordType
    )

    customRecordType.annotations.customsegment = new ReferenceExpression(
      customSegmentInstance.elemID, 'val', customSegmentInstance
    )

    const datasetInstance = new InstanceElement('datasetInstance',
      dataset, {
        [SCRIPT_ID]: 'custdataset_my_script_id',
      })

    const workbookInstance = new InstanceElement('workbookInstance',
      workbook, {
        [SCRIPT_ID]: 'custworkbook_my_script_id',
        dependencies: {
          dependency: new ReferenceExpression(
            datasetInstance.elemID, 'val', datasetInstance
          ),
        },
      })

    it('should not add dependencies that are not required', async () => {
      const result = await getReferencedElements([instanceWithManyRefs], false)
      expect(result).toEqual([instanceWithManyRefs])
    })

    it('should add CUSTOM_SEGMENT dependency of CUSTOM_RECORD_TYPE', async () => {
      const result = await getReferencedElements([customRecordType], false)
      expect(result).toEqual([customRecordType, customSegmentInstance])
    })

    it('should add CUSTOM_RECORD_TYPE dependency of CUSTOM_SEGMENT', async () => {
      const result = await getReferencedElements([customSegmentInstance], false)
      expect(result).toEqual([customSegmentInstance, customRecordType])
    })

    it('should add DATASET dependency of WORKBOOK', async () => {
      const result = await getReferencedElements([workbookInstance], false)
      expect(result).toEqual([workbookInstance, datasetInstance])
    })

    it('should not add dependencies that already exist', async () => {
      const input = [customRecordType, customSegmentInstance, workbookInstance,
        datasetInstance, instance]
      const result = await getReferencedElements(input, false)
      expect(result).toEqual(input)
    })

    it('should not add new dependencies more then once', async () => {
      const customRecordTypeInstance2 = new InstanceElement('customRecordTypeInstance2',
        customrecordtype, {
          [SCRIPT_ID]: 'customrecord_my_script_id_2',
          customsegment: new ReferenceExpression(
            customSegmentInstance.elemID, 'val', customSegmentInstance
          ),
        })

      const result = await getReferencedElements(
        [customRecordType, customRecordTypeInstance2],
        false
      )
      expect(result)
        .toEqual([customRecordType, customRecordTypeInstance2, customSegmentInstance])
    })
  })
})
