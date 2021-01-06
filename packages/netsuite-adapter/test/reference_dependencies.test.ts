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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, ReferenceExpression, StaticFile } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import {
  CUSTOM_RECORD_TYPE, CUSTOM_SEGMENT, DATASET, ENTITY_CUSTOM_FIELD, FILE, PATH, SCRIPT_ID, WORKBOOK,
  TRANSACTION_COLUMN_CUSTOM_FIELD, TRANSACTION_BODY_CUSTOM_FIELD,
} from '../src/constants'
import { customTypes, fileCabinetTypes } from '../src/types'
import {
  getAllReferencedInstances,
  getRequiredReferencedInstances,
} from '../src/reference_dependencies'

describe('reference dependencies', () => {
  const fileInstance = new InstanceElement('fileInstance', fileCabinetTypes[FILE], {
    [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
  })

  const dependsOn1Instance = new InstanceElement('dependsOn1Instance', customTypes[ENTITY_CUSTOM_FIELD], {
    [SCRIPT_ID]: 'custentity_depends_on_1_instance',
    label: new ReferenceExpression(fileInstance.elemID.createNestedID(PATH),
      fileInstance.value[PATH], fileInstance),
  })

  const instance = new InstanceElement('elementName',
    customTypes[ENTITY_CUSTOM_FIELD], {
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
        id: { refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID) },
      } }),
    { id: 'serviceIdValue' },
  )

  const instanceWithManyRefs = new InstanceElement('dependsOn2Instances', customTypes[ENTITY_CUSTOM_FIELD], {
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
      const result = getAllReferencedInstances([instanceWithManyRefs])
      expect(result).toEqual([instanceWithManyRefs, dependsOn1Instance, fileInstance])
    })
  })
  describe('getRequiredReferencedInstances', () => {
    const customRecordTypeInstance = new InstanceElement('customRecordTypeInstance',
      customTypes[CUSTOM_RECORD_TYPE], {
        [SCRIPT_ID]: 'customrecord_my_script_id',
      })

    const customSegmentInstance = new InstanceElement('customSegmentInstance',
      customTypes[CUSTOM_SEGMENT], {
        [SCRIPT_ID]: 'cseg_my_script_id',
      })

    customSegmentInstance.value.recordtype = new ReferenceExpression(
      customRecordTypeInstance.elemID, 'val', customRecordTypeInstance
    )

    customRecordTypeInstance.value.customsegment = new ReferenceExpression(
      customSegmentInstance.elemID, 'val', customSegmentInstance
    )

    const datasetInstance = new InstanceElement('datasetInstance',
      customTypes[DATASET], {
        [SCRIPT_ID]: 'custdataset_my_script_id',
      })

    const workbookInstance = new InstanceElement('workbookInstance',
      customTypes[WORKBOOK], {
        [SCRIPT_ID]: 'custworkbook_my_script_id',
        dependencies: {
          dependency: new ReferenceExpression(
            datasetInstance.elemID, 'val', datasetInstance
          ),
        },
      })

    const transactionColumnCustomFieldInstance = new InstanceElement('instance',
      customTypes[TRANSACTION_COLUMN_CUSTOM_FIELD], {
        [SCRIPT_ID]: 'custcol_my_script_id',
        sourcefrom: new ReferenceExpression(
          instance.elemID, 'val', instance
        ),
      })

    const transactionBodyCustomFieldInstance = new InstanceElement('instance',
      customTypes[TRANSACTION_BODY_CUSTOM_FIELD], {
        [SCRIPT_ID]: 'custbody_my_script_id',
        sourcefrom: new ReferenceExpression(
          instance.elemID, 'val', instance
        ),
      })

    it('should not add dependencies that are not required', async () => {
      const result = await getRequiredReferencedInstances([instanceWithManyRefs])
      expect(result).toEqual([instanceWithManyRefs])
    })

    it('should add CUSTOM_SEGMENT dependency of CUSTOM_RECORD_TYPE', async () => {
      const result = await getRequiredReferencedInstances([customRecordTypeInstance])
      expect(result).toEqual([customRecordTypeInstance, customSegmentInstance])
    })

    it('should add CUSTOM_RECORD_TYPE dependency of CUSTOM_SEGMENT', async () => {
      const result = await getRequiredReferencedInstances([customSegmentInstance])
      expect(result).toEqual([customSegmentInstance, customRecordTypeInstance])
    })

    it('should add DATASET dependency of WORKBOOK', async () => {
      const result = await getRequiredReferencedInstances([workbookInstance])
      expect(result).toEqual([workbookInstance, datasetInstance])
    })

    it('should add dependency of TRANSACTION_COLUMN_CUSTOM_FIELD', async () => {
      const result = await getRequiredReferencedInstances([transactionColumnCustomFieldInstance])
      expect(result).toEqual([transactionColumnCustomFieldInstance, instance])
    })

    it('should add dependency of TRANSACTION_BODY_CUSTOM_FIELD', async () => {
      const result = await getRequiredReferencedInstances([transactionBodyCustomFieldInstance])
      expect(result).toEqual([transactionBodyCustomFieldInstance, instance])
    })

    it('should not add dependencies that already exist', async () => {
      const input = [customRecordTypeInstance, customSegmentInstance, workbookInstance,
        datasetInstance, transactionColumnCustomFieldInstance, instance]
      const result = await getRequiredReferencedInstances(input)
      expect(result).toEqual(input)
    })

    it('should not add new dependencies more then once', async () => {
      const customRecordTypeInstance2 = new InstanceElement('customRecordTypeInstance2',
        customTypes[CUSTOM_RECORD_TYPE], {
          [SCRIPT_ID]: 'customrecord_my_script_id_2',
          customsegment: new ReferenceExpression(
            customSegmentInstance.elemID, 'val', customSegmentInstance
          ),
        })

      const result = await getRequiredReferencedInstances(
        [customRecordTypeInstance, customRecordTypeInstance2]
      )
      expect(result)
        .toEqual([customRecordTypeInstance, customRecordTypeInstance2, customSegmentInstance])
    })
  })
})
