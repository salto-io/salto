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
import {
  BuiltinTypes,
  Change,
  ElemID,
  Element,
  InstanceElement,
  ObjectType,
  createRefToElmWithValue,
  getChangeData,
  isModificationChange,
  toChange,
} from '@salto-io/adapter-api'
import { fileType as fileTypeCreator } from '../../src/types/file_cabinet_types'
import { entryFormType } from '../../src/autogen/types/standard_types/entryForm'
import { customrecordtypeType } from '../../src/autogen/types/standard_types/customrecordtype'
import { workflowType as workflowTypeCreator } from '../../src/autogen/types/standard_types/workflow'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SOAP, SOURCE } from '../../src/constants'
import { LocalFilterOpts } from '../../src/filter'
import { TypeAndInnerTypes } from '../../src/types/object_types'
import filterCreator from '../../src/filters/align_field_names'

describe('align field names filter', () => {
  let formType: ObjectType
  let fileType: ObjectType
  let workflowType: ObjectType
  let workflowInnerTypes: ObjectType[]
  let dataType: ObjectType
  let standardCustomRecordType: TypeAndInnerTypes
  let customRecordType: ObjectType
  let formInstance: InstanceElement
  let fileInstance: InstanceElement
  let workflowInstance: InstanceElement
  let dataInstance: InstanceElement
  let elements: Element[]

  beforeEach(() => {
    formType = entryFormType().type
    fileType = fileTypeCreator()
    const workflowTypeAndInnerTypes = workflowTypeCreator()
    workflowType = workflowTypeAndInnerTypes.type
    workflowInnerTypes = Object.values(workflowTypeAndInnerTypes.innerTypes)
    dataType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'account'),
      fields: {
        isinactive: {
          refType: BuiltinTypes.BOOLEAN,
          annotations: { someAnno: 'test' },
        },
      },
      annotations: {
        [SOURCE]: SOAP,
      },
    })
    standardCustomRecordType = customrecordtypeType()
    customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord123'),
      annotationRefsOrTypes: {
        isinactive: BuiltinTypes.BOOLEAN,
        instances: standardCustomRecordType.innerTypes.customrecordtype_instances,
      },
      annotations: {
        scriptid: 'customrecord123',
        isinactive: false,
        instances: {
          instance: [
            {
              scriptid: 'val123',
              isinactive: true,
            },
            {
              scriptid: 'val456',
              isinactive: false,
            },
          ],
        },
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    formInstance = new InstanceElement('form123', formType, {
      scriptid: 'form123',
      inactive: true,
    })
    fileInstance = new InstanceElement('file123', fileType, {
      path: '/file123',
      isinactive: false,
    })
    workflowInstance = new InstanceElement('workflow123', workflowType, {
      scriptid: 'workflow123',
      isinactive: false,
      workflowstates: {
        workflowstate: [
          {
            scriptid: 'workflowstate6',
            workflowactions: [
              {
                triggertype: 'ONENTRY',
                setfieldvalueaction: [
                  {
                    scriptid: 'workflowaction23',
                    isinactive: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    })
    dataInstance = new InstanceElement('data123', dataType, {
      name: 'data123',
      isinactive: false,
    })
    elements = [
      formType,
      fileType,
      workflowType,
      ...workflowInnerTypes,
      dataType,
      standardCustomRecordType.innerTypes.customrecordtype_instances_instance,
      customRecordType,
      formInstance,
      fileInstance,
      workflowInstance,
      dataInstance,
    ]
  })

  describe('on fetch', () => {
    beforeEach(async () => {
      await filterCreator({} as LocalFilterOpts).onFetch?.(elements)
    })
    it('should align fields in types', () => {
      expect(formType.fields.isInactive).toBeDefined()
      expect(formType.fields.isInactive.annotations).toEqual({ originalName: 'inactive' })
      expect(fileType.fields.isInactive).toBeDefined()
      expect(fileType.fields.isInactive.annotations).toEqual({ originalName: 'isinactive' })
      expect(workflowType.fields.isInactive).toBeDefined()
      expect(workflowType.fields.isInactive.annotations).toEqual({ originalName: 'isinactive' })
      const innerWorkflowType = workflowInnerTypes.find(
        type => type.elemID.name === 'workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction',
      )
      expect(innerWorkflowType?.fields.isInactive).toBeDefined()
      expect(innerWorkflowType?.fields.isInactive.annotations).toEqual({ originalName: 'isinactive' })
      expect(dataType.fields.isInactive).toBeDefined()
      expect(dataType.fields.isInactive.annotations).toEqual({ originalName: 'isinactive', someAnno: 'test' })
      expect(standardCustomRecordType.innerTypes.customrecordtype_instances_instance.fields.isInactive).toBeDefined()
      expect(
        standardCustomRecordType.innerTypes.customrecordtype_instances_instance.fields.isInactive.annotations,
      ).toEqual({ originalName: 'isinactive' })
    })
    it('should align fields in instances', () => {
      expect(formInstance.value).toEqual({
        scriptid: 'form123',
        isInactive: true,
      })
      expect(fileInstance.value).toEqual({
        path: '/file123',
        isInactive: false,
      })
      expect(workflowInstance.value).toEqual({
        scriptid: 'workflow123',
        isInactive: false,
        workflowstates: {
          workflowstate: [
            {
              scriptid: 'workflowstate6',
              workflowactions: [
                {
                  triggertype: 'ONENTRY',
                  setfieldvalueaction: [
                    {
                      scriptid: 'workflowaction23',
                      isInactive: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
      })
      expect(dataInstance.value).toEqual({
        name: 'data123',
        isInactive: false,
      })
    })
    it('should align custom record type annotations', () => {
      expect(customRecordType.annotationRefTypes).toEqual({
        isInactive: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        instances: createRefToElmWithValue(standardCustomRecordType.innerTypes.customrecordtype_instances),
      })
      expect(customRecordType.annotations).toEqual({
        scriptid: 'customrecord123',
        isInactive: false,
        instances: {
          instance: [
            {
              scriptid: 'val123',
              isInactive: true,
            },
            {
              scriptid: 'val456',
              isInactive: false,
            },
          ],
        },
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      })
    })
  })

  describe('pre deploy', () => {
    let customRecordTypeChange: Change<ObjectType>
    let formInstanceChange: Change<InstanceElement>
    let fileInstanceChange: Change<InstanceElement>
    let workflowInstanceChange: Change<InstanceElement>
    let dataInstanceChange: Change<InstanceElement>
    let changes: Change[]
    beforeEach(async () => {
      await filterCreator({} as LocalFilterOpts).onFetch?.(elements)
      customRecordTypeChange = toChange({
        before: customRecordType.clone(),
        after: customRecordType.clone(),
      })
      formInstanceChange = toChange({
        before: formInstance.clone(),
        after: formInstance.clone(),
      })
      fileInstanceChange = toChange({
        before: fileInstance.clone(),
        after: fileInstance.clone(),
      })
      workflowInstanceChange = toChange({
        before: workflowInstance.clone(),
        after: workflowInstance.clone(),
      })
      dataInstanceChange = toChange({
        before: dataInstance.clone(),
        after: dataInstance.clone(),
      })
      changes = [
        customRecordTypeChange,
        formInstanceChange,
        fileInstanceChange,
        workflowInstanceChange,
        dataInstanceChange,
      ]
      await filterCreator({} as LocalFilterOpts).preDeploy?.(changes)
    })
    it('should restore field names in instances', () => {
      expect(getChangeData(formInstanceChange).value).toEqual({
        scriptid: 'form123',
        inactive: true,
      })
      expect(getChangeData(fileInstanceChange).value).toEqual({
        path: '/file123',
        isinactive: false,
      })
      expect(getChangeData(workflowInstanceChange).value).toEqual({
        scriptid: 'workflow123',
        isinactive: false,
        workflowstates: {
          workflowstate: [
            {
              scriptid: 'workflowstate6',
              workflowactions: [
                {
                  triggertype: 'ONENTRY',
                  setfieldvalueaction: [
                    {
                      scriptid: 'workflowaction23',
                      isinactive: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
      })
      expect(getChangeData(dataInstanceChange).value).toEqual({
        name: 'data123',
        isinactive: false,
      })
    })
    it('should restore annotations in custom record type', () => {
      expect(getChangeData(customRecordTypeChange).annotationRefTypes).toEqual({
        isinactive: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        instances: createRefToElmWithValue(standardCustomRecordType.innerTypes.customrecordtype_instances),
      })
      expect(getChangeData(customRecordTypeChange).annotations).toEqual({
        scriptid: 'customrecord123',
        isinactive: false,
        instances: {
          instance: [
            {
              scriptid: 'val123',
              isinactive: true,
            },
            {
              scriptid: 'val456',
              isinactive: false,
            },
          ],
        },
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      })
    })
    it('should restore also before of data instances', () => {
      expect(isModificationChange(dataInstanceChange) && dataInstanceChange.data.before.value).toEqual({
        name: 'data123',
        isinactive: false,
      })
    })
  })
})
