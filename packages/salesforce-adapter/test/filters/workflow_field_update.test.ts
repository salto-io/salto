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
import {
  ElemID, InstanceElement, ObjectType, ReferenceExpression,
  BuiltinTypes,
} from '@salto-io/adapter-api'
import { FilterWith } from '../../src/filter'
import filterCreator, {
  WORKFLOW_FIELD_UPDATE_TYPE_ID,
} from '../../src/filters/workflow_field_update'
import mockClient from '../client'
import {
  API_NAME, API_NAME_SEPARATOR, INSTANCE_FULL_NAME_FIELD, OBJECTS_PATH, SALESFORCE,
  CUSTOM_OBJECT,
  METADATA_TYPE,
  WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
} from '../../src/constants'

describe('WorklowFieldUpdate filter', () => {
  const { client } = mockClient()

  const filter = filterCreator({ client, config: {} }) as FilterWith<'onFetch'>

  const workflowFieldUpdateInstanceName = 'update_user_signature'
  const parentName = 'CustomUser'

  const customParentObject = new ObjectType({
    elemID: new ElemID(SALESFORCE, parentName),
    annotations: { [METADATA_TYPE]: CUSTOM_OBJECT },
  })

  const generateWorkFlowFieldUpdateInstance = (
    workflowParentName = parentName,
    referencedFieldName = 'signature',
  ): InstanceElement => {
    const workflowFieldUpdateObjectType = new ObjectType({ elemID: WORKFLOW_FIELD_UPDATE_TYPE_ID })
    const instanceName = `${workflowParentName}_${workflowFieldUpdateInstanceName}`
    return new InstanceElement(
      instanceName,
      workflowFieldUpdateObjectType,
      {
        [INSTANCE_FULL_NAME_FIELD]: `${workflowParentName}${API_NAME_SEPARATOR}${workflowFieldUpdateInstanceName}`,
        field: referencedFieldName,
        description: 'description',
        name: `update ${referencedFieldName}`,
        formula: `new ${referencedFieldName} 1`,
        notifyAssignee: false,
        operation: 'Formula',
        protected: false,
      },
      [SALESFORCE, OBJECTS_PATH, WORKFLOW_FIELD_UPDATE_METADATA_TYPE, instanceName]
    )
  }

  describe('on fetch', () => {
    let instance: InstanceElement
    let standardFieldObj: ObjectType
    let unknownFieldInstance: InstanceElement
    let unknownParentInstance: InstanceElement

    beforeAll(async () => {
      instance = generateWorkFlowFieldUpdateInstance()
      const workflowFieldUpdateType = instance.type

      const testSobjPath = [SALESFORCE, OBJECTS_PATH, 'test']
      const testSObj = customParentObject.clone()
      testSObj.annotate({ [API_NAME]: parentName })
      testSObj.path = testSobjPath

      standardFieldObj = new ObjectType({
        elemID: testSObj.elemID,
        path: [SALESFORCE],
        fields: { signature: { type: BuiltinTypes.STRING, annotations: { apiName: 'signature' } } },
      })

      unknownFieldInstance = generateWorkFlowFieldUpdateInstance(parentName, 'unknownField')
      unknownParentInstance = generateWorkFlowFieldUpdateInstance('UnknownParent')

      const elements = [
        testSObj, standardFieldObj, workflowFieldUpdateType, instance,
        unknownFieldInstance, unknownParentInstance,
      ]
      await filter.onFetch(elements)
    })

    it('should have reference from field to parent field', () => {
      expect(instance.value?.field).toBeInstanceOf(ReferenceExpression)
      expect(instance.value?.field?.elemId).toEqual(standardFieldObj.fields.signature.elemID)
    })

    it('should not convert to reference for an unknown parent object', () => {
      expect(unknownParentInstance.value?.field).toEqual('signature')
    })

    it('should not convert to reference for an unknown field', () => {
      expect(unknownFieldInstance.value?.field).toEqual('unknownField')
    })
  })
})
