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
import { collections } from '@salto-io/lowerdash'
import { BuiltinTypes, createRefToElmWithValue, ElemID, Field, FieldMap, InstanceElement, isListType, isMapType, isObjectType, ListType, MapType, ObjectType } from '@salto-io/adapter-api'
import { convertFieldsTypesFromListToMap, createConvertStandardElementMapsToLists, convertInstanceListsToMaps, getMappedLists, isMappedList, validateTypesFieldMapping, convertAnnotationListsToMaps, convertDataInstanceMapsToLists } from '../../src/mapped_lists/utils'
import { getStandardTypes } from '../../src/autogen/types'
import { LIST_MAPPED_BY_FIELD, NETSUITE, SCRIPT_ID } from '../../src/constants'
import { getInnerStandardTypes, getTopLevelStandardTypes } from '../../src/types'
import { toAnnotationRefTypes } from '../../src/custom_records/custom_record_type'

const { awu } = collections.asynciterable

describe('mapped lists', () => {
  const standardTypes = getStandardTypes()
  const { workflow, kpiscorecard, customrecordtype } = standardTypes

  const classTranslationType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'classTranslation'),
    fields: {
      locale: { refType: BuiltinTypes.STRING },
      language: { refType: BuiltinTypes.STRING },
      name: { refType: BuiltinTypes.STRING },
    },
  })

  let instance: InstanceElement
  let transformedInstance: InstanceElement
  let transformedBackInstance: InstanceElement
  let customRecordType: ObjectType
  let transformedCustomRecordType: ObjectType
  let transformedBackCustomRecordType: ObjectType
  let classTranslationListType: ObjectType
  let dataInstance: InstanceElement
  let transformedDataInstance: InstanceElement
  let transformedBackDataInstance: InstanceElement
  beforeAll(async () => {
    instance = new InstanceElement(
      'instanceName',
      workflow.type,
      {
        scriptid: 'customworkflow_changed_id',
        workflowcustomfields: {
          workflowcustomfield: [
            {
              scriptid: 'custworkflow1',
            },
            {
              scriptid: 'custworkflow2',
            },
            {
              scriptid: 's0m@ $CR1pt!*()',
            },
            {
              scriptid: '[scriptid=custworkflow2]',
            },
            {
              scriptid: '[type=workflow, scriptid=custworkflow2]',
            },
            {
              scriptid: 's0m@ $CR1pt!*()',
            },
          ],
        },
        workflowstates: {
          workflowstate: [
            {
              scriptid: 'workflowstate1',
              workflowactions: [
                {
                  triggertype: 'ONENTRY',
                  setfieldvalueaction: [
                    {
                      scriptid: 'workflowaction1',
                    },
                    {
                      scriptid: 'workflowaction2',
                    },
                  ],
                },
                {
                  triggertype: 'BEFORELOAD',
                  setfieldvalueaction: [
                    {
                      scriptid: 'workflowaction3',
                    },
                    {
                      scriptid: 'workflowaction4',
                    },
                  ],
                },
              ],
            },
          ],
        },
      }
    )

    customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      fields: {
        scriptid: { refType: BuiltinTypes.SERVICE_ID },
        internalId: { refType: BuiltinTypes.STRING },
        custom_custrecord_field: {
          refType: BuiltinTypes.STRING,
          annotations: {
            scriptid: 'custrecord_field',
            customfieldfilters: {
              customfieldfilter: {
                fldfilter: 'STDITEMPARENT',
                fldfiltercomparetype: 'EQ',
                fldfilternotnull: true,
                fldfilternull: false,
              },
            },
          },
        },
      },
      annotations: {
        scriptid: 'customrecord1',
        permissions: {
          permission: [{
            permittedlevel: 'EDIT',
            permittedrole: '[scriptid=customrole1]',
          }],
        },
        metadataType: 'customrecordtype',
      },
      annotationRefsOrTypes: toAnnotationRefTypes(customrecordtype.type),
    })

    classTranslationListType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'classTranslationList'),
      fields: {
        classTranslation: { refType: new ListType(classTranslationType) },
        replaceAll: { refType: BuiltinTypes.BOOLEAN },
      },
    })
    const dataType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'subsidiary'),
      fields: {
        identifier: { refType: BuiltinTypes.SERVICE_ID },
        internalId: { refType: BuiltinTypes.STRING },
        classTranslationList: { refType: classTranslationListType },
      },
    })
    dataInstance = new InstanceElement('subsidiary1', dataType, {
      identifier: 'subsidiary1',
      internalId: '1',
      classTranslationList: {
        classTranslation: [{
          language: 'Czech',
          name: 'a',
        }, {
          language: 'Danish',
          name: 'b',
        }, {
          language: 'German',
          name: 'c',
        }],
      },
    })

    await awu([
      ...Object.values(workflow.innerTypes),
      ...Object.values(kpiscorecard.innerTypes),
      ...Object.values(customrecordtype.innerTypes),
      classTranslationListType,
    ])
      .forEach(t => convertFieldsTypesFromListToMap(t))

    transformedInstance = instance.clone()
    transformedInstance.value = await convertInstanceListsToMaps(instance) ?? {}
    transformedCustomRecordType = customRecordType.clone()
    transformedCustomRecordType.annotations = await convertAnnotationListsToMaps(customRecordType)
    transformedDataInstance = dataInstance.clone()
    transformedDataInstance.value = await convertInstanceListsToMaps(dataInstance) ?? {}

    const convertElementMapsToLists = await createConvertStandardElementMapsToLists()
    transformedBackInstance = await convertElementMapsToLists(transformedInstance) as InstanceElement
    transformedBackCustomRecordType = await convertElementMapsToLists(transformedCustomRecordType) as ObjectType
    transformedBackDataInstance = await convertDataInstanceMapsToLists(transformedDataInstance)
  })
  describe('validateTypesFieldMapping', () => {
    const types = [
      ...getTopLevelStandardTypes(standardTypes),
      ...getInnerStandardTypes(standardTypes),
      new ObjectType({
        elemID: new ElemID(NETSUITE, 'translation'),
        fields: {
          locale: { refType: BuiltinTypes.STRING },
          language: { refType: BuiltinTypes.STRING },
        },
      }),
      classTranslationType,
      new ObjectType({
        elemID: new ElemID(NETSUITE, 'customRecordTranslations'),
        fields: {
          locale: { refType: BuiltinTypes.STRING },
          language: { refType: BuiltinTypes.STRING },
        },
      }),
    ]
    it('should not throw', () => {
      expect(() => validateTypesFieldMapping(types)).not.toThrow()
    })
    it('should throw when missing some types with field mapping', async () => {
      const missingTypes = types.filter(element => element.elemID.name !== 'addressForm_mainFields_defaultFieldGroup_fields')
      expect(() => validateTypesFieldMapping(missingTypes)).toThrow()

      const typeWithMissingField = new ObjectType({
        elemID: new ElemID(NETSUITE, 'addressForm_mainFields_defaultFieldGroup_fields'),
        fields: {
          positions: {
            refType: createRefToElmWithValue(BuiltinTypes.STRING),
          },
        },
      })
      expect(() => validateTypesFieldMapping([...missingTypes, typeWithMissingField])).toThrow()
    })
  })
  it('should modify ObjectTypes fields', async () => {
    const workflowcustomfields = workflow.innerTypes.workflow_workflowcustomfields
    expect(workflowcustomfields).toBeDefined()
    const { workflowcustomfield } = workflowcustomfields?.fields as FieldMap
    expect(isMapType(await workflowcustomfield.getType())).toBeTruthy()
    expect(workflowcustomfield.annotations)
      .toEqual({ [LIST_MAPPED_BY_FIELD]: SCRIPT_ID })

    const workflowstates = workflow.innerTypes.workflow_workflowstates
    expect(workflowstates).toBeDefined()
    const { workflowstate } = workflowstates?.fields as FieldMap
    expect(isMapType(await workflowstate.getType())).toBeTruthy()
    expect(workflowstate.annotations)
      .toEqual({ [LIST_MAPPED_BY_FIELD]: SCRIPT_ID })

    const workflowstateObject = workflow.innerTypes.workflow_workflowstates_workflowstate
    expect(workflowstateObject).toBeDefined()
    const { workflowactions } = workflowstateObject?.fields as FieldMap
    expect(isMapType(await workflowactions.getType())).toBeTruthy()
    expect(workflowactions.annotations)
      .toEqual({ [LIST_MAPPED_BY_FIELD]: 'triggertype' })

    expect(isMapType(await classTranslationListType.fields.classTranslation.getType())).toBeTruthy()
    expect(classTranslationListType.fields.classTranslation.annotations)
      .toEqual({ [LIST_MAPPED_BY_FIELD]: ['locale', 'language'] })
  })
  it('should add index field', () => {
    expect(workflow.innerTypes.workflow_workflowstates_workflowstate_workflowactions.fields.index).toBeDefined()
  })
  it('should not add index field to unordered lists', async () => {
    expect(customrecordtype.innerTypes.customrecordtype_permissions_permission.fields.index).toBeUndefined()
    expect(classTranslationType.fields.index).toBeUndefined()
  })
  it('should not modify ObjectTypes fields when types has no field to map by', async () => {
    const highlightings = kpiscorecard.innerTypes.kpiscorecard_highlightings
    expect(highlightings).toBeDefined()
    const { highlighting } = highlightings?.fields as FieldMap
    expect(isListType(await highlighting.getType())).toBeTruthy()
    expect(highlighting.annotations[LIST_MAPPED_BY_FIELD]).toBeUndefined()
  })
  it('should modify standard instance values', () => {
    expect(transformedInstance.value).toEqual({
      scriptid: 'customworkflow_changed_id',
      workflowcustomfields: {
        workflowcustomfield: {
          custworkflow1: {
            scriptid: 'custworkflow1',
            index: 0,
          },
          custworkflow2: {
            scriptid: 'custworkflow2',
            index: 1,
          },
          's0m___CR1pt____@mszclojk': {
            scriptid: 's0m@ $CR1pt!*()',
            index: 2,
          },
          custworkflow2_2: {
            scriptid: '[scriptid=custworkflow2]',
            index: 3,
          },
          custworkflow2_3: {
            scriptid: '[type=workflow, scriptid=custworkflow2]',
            index: 4,
          },
          's0m___CR1pt_____2@mszclojku': {
            scriptid: 's0m@ $CR1pt!*()',
            index: 5,
          },
        },
      },
      workflowstates: {
        workflowstate: {
          workflowstate1: {
            scriptid: 'workflowstate1',
            index: 0,
            workflowactions: {
              BEFORELOAD: {
                index: 1,
                setfieldvalueaction: {
                  workflowaction3: {
                    index: 0,
                    scriptid: 'workflowaction3',
                  },
                  workflowaction4: {
                    index: 1,
                    scriptid: 'workflowaction4',
                  },
                },
                triggertype: 'BEFORELOAD',
              },
              ONENTRY: {
                triggertype: 'ONENTRY',
                index: 0,
                setfieldvalueaction: {
                  workflowaction1: {
                    index: 0,
                    scriptid: 'workflowaction1',
                  },
                  workflowaction2: {
                    index: 1,
                    scriptid: 'workflowaction2',
                  },
                },
              },
            },
          },
        },
      },
    })
  })
  it('should modify data instance values', () => {
    expect(transformedDataInstance.value).toEqual({
      identifier: 'subsidiary1',
      internalId: '1',
      classTranslationList: {
        classTranslation: {
          Czech: {
            language: 'Czech',
            name: 'a',
          },
          Danish: {
            language: 'Danish',
            name: 'b',
          },
          German: {
            language: 'German',
            name: 'c',
          },
        },
      },
    })
  })
  it('should modify custom record type annotations', () => {
    expect(transformedCustomRecordType.annotations).toEqual({
      scriptid: 'customrecord1',
      permissions: {
        permission: {
          customrole1: {
            permittedlevel: 'EDIT',
            permittedrole: '[scriptid=customrole1]',
          },
        },
      },
      metadataType: 'customrecordtype',
    })
  })
  it('should not convert list if the inner type is not an ObjectType', async () => {
    const elemID = new ElemID(NETSUITE, 'newType')
    const type = new ObjectType({
      elemID,
      fields: {
        primitiveList: {
          refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
        },
      },
    })
    await convertFieldsTypesFromListToMap(type)
    const { primitiveList } = type.fields
    expect(isListType(await primitiveList.getType())).toBeTruthy()
    expect(primitiveList.annotations).toEqual({})
  })
  it('should use \'key\' as item key if item has no \'LIST_MAPPED_BY_FIELD\' field', async () => {
    const inst = new InstanceElement(
      'instance',
      workflow.type,
      {
        scriptid: 'customworkflow_changed_id',
        workflowcustomfields: {
          workflowcustomfield: [
            {
              scriptid: 'custworkflow1',
            },
            {
              notscriptid: 'custworkflow2',
            },
          ],
        },
      },
    )
    expect(await convertInstanceListsToMaps(inst)).toEqual({
      scriptid: 'customworkflow_changed_id',
      workflowcustomfields: {
        workflowcustomfield: {
          custworkflow1: {
            scriptid: 'custworkflow1',
            index: 0,
          },
          key: {
            notscriptid: 'custworkflow2',
            index: 1,
          },
        },
      },
    })
  })
  describe('isMappedList', () => {
    const elemID = new ElemID(NETSUITE, 'newType')
    const elemIDinner = new ElemID(NETSUITE, 'inner')
    const type = new ObjectType({ elemID })
    const innerType = new ObjectType({ elemID: elemIDinner })
    it('should return false when field has no mapping annotation', async () => {
      expect(await isMappedList(
        { a: { a: 1 }, b: { b: 2 } },
        new Field(
          type,
          'field',
          createRefToElmWithValue(new MapType(innerType))
        )
      )).toBeFalsy()
    })
    it('should return false when value is not a plain object', async () => {
      expect(await isMappedList(
        [{ a: 1 }, { b: 2 }],
        new Field(
          type,
          'field',
          createRefToElmWithValue(new MapType(innerType)),
          { [LIST_MAPPED_BY_FIELD]: 'scriptid' }
        )
      )).toBeFalsy()
    })
    it('should return false when field type is not map/list', async () => {
      expect(await isMappedList(
        { a: { a: 1 }, b: { b: 2 } },
        new Field(
          type,
          'field',
          createRefToElmWithValue(innerType),
          { [LIST_MAPPED_BY_FIELD]: 'scriptid' }
        )
      )).toBeFalsy()
    })
    it('should return true when field is list', async () => {
      expect(await isMappedList(
        { a: { a: 1 }, b: { b: 2 } },
        new Field(
          type,
          'field',
          createRefToElmWithValue(new ListType(innerType)),
          { [LIST_MAPPED_BY_FIELD]: 'scriptid' }
        )
      )).toBeTruthy()
    })
    it('should return true when field is map', async () => {
      expect(await isMappedList(
        { a: { a: 1 }, b: { b: 2 } },
        new Field(
          type,
          'field',
          createRefToElmWithValue(new MapType(innerType)),
          { [LIST_MAPPED_BY_FIELD]: 'scriptid' }
        )
      )).toBeTruthy()
    })
  })
  it('should return mapped lists', async () => {
    expect(await getMappedLists(transformedInstance)).toEqual([
      {
        field: workflow.innerTypes.workflow_workflowcustomfields.fields.workflowcustomfield,
        path: new ElemID('netsuite', 'workflow', 'instance', 'instanceName', 'workflowcustomfields', 'workflowcustomfield'),
        value: {
          custworkflow1: {
            scriptid: 'custworkflow1',
            index: 0,
          },
          custworkflow2: {
            scriptid: 'custworkflow2',
            index: 1,
          },
          's0m___CR1pt____@mszclojk': {
            scriptid: 's0m@ $CR1pt!*()',
            index: 2,
          },
          custworkflow2_2: {
            scriptid: '[scriptid=custworkflow2]',
            index: 3,
          },
          custworkflow2_3: {
            scriptid: '[type=workflow, scriptid=custworkflow2]',
            index: 4,
          },
          's0m___CR1pt_____2@mszclojku': {
            scriptid: 's0m@ $CR1pt!*()',
            index: 5,
          },
        },
      },
      {
        field: workflow.innerTypes.workflow_workflowstates.fields.workflowstate,
        path: new ElemID('netsuite', 'workflow', 'instance', 'instanceName', 'workflowstates', 'workflowstate'),
        value: {
          workflowstate1: {
            index: 0,
            scriptid: 'workflowstate1',
            workflowactions: {
              BEFORELOAD: {
                index: 1,
                triggertype: 'BEFORELOAD',
                setfieldvalueaction: {
                  workflowaction3: {
                    index: 0,
                    scriptid: 'workflowaction3',
                  },
                  workflowaction4: {
                    index: 1,
                    scriptid: 'workflowaction4',
                  },
                },
              },
              ONENTRY: {
                index: 0,
                triggertype: 'ONENTRY',
                setfieldvalueaction: {
                  workflowaction1: {
                    index: 0,
                    scriptid: 'workflowaction1',
                  },
                  workflowaction2: {
                    index: 1,
                    scriptid: 'workflowaction2',
                  },
                },
              },
            },
          },
        },
      },
      {
        field: workflow.innerTypes.workflow_workflowstates_workflowstate.fields.workflowactions,
        path: new ElemID('netsuite', 'workflow', 'instance', 'instanceName', 'workflowstates', 'workflowstate', 'workflowstate1', 'workflowactions'),
        value: {
          BEFORELOAD: {
            index: 1,
            setfieldvalueaction: {
              workflowaction3: {
                index: 0,
                scriptid: 'workflowaction3',
              },
              workflowaction4: {
                index: 1,
                scriptid: 'workflowaction4',
              },
            },
            triggertype: 'BEFORELOAD',
          },
          ONENTRY: {
            index: 0,
            setfieldvalueaction: {
              workflowaction1: {
                index: 0,
                scriptid: 'workflowaction1',
              },
              workflowaction2: {
                index: 1,
                scriptid: 'workflowaction2',
              },
            },
            triggertype: 'ONENTRY',
          },
        },
      },
      {
        field: workflow.innerTypes.workflow_workflowstates_workflowstate_workflowactions.fields.setfieldvalueaction,
        path: new ElemID('netsuite', 'workflow', 'instance', 'instanceName', 'workflowstates', 'workflowstate', 'workflowstate1', 'workflowactions', 'ONENTRY', 'setfieldvalueaction'),
        value: {
          workflowaction1: {
            index: 0,
            scriptid: 'workflowaction1',
          },
          workflowaction2: {
            index: 1,
            scriptid: 'workflowaction2',
          },
        },
      },
      {
        field: workflow.innerTypes.workflow_workflowstates_workflowstate_workflowactions.fields.setfieldvalueaction,
        path: new ElemID('netsuite', 'workflow', 'instance', 'instanceName', 'workflowstates', 'workflowstate', 'workflowstate1', 'workflowactions', 'BEFORELOAD', 'setfieldvalueaction'),
        value: {
          workflowaction3: {
            index: 0,
            scriptid: 'workflowaction3',
          },
          workflowaction4: {
            index: 1,
            scriptid: 'workflowaction4',
          },
        },
      },
    ])
  })
  it('should convert map back to a list in standard instance', () => {
    expect(transformedBackInstance.value).toEqual(instance.value)
  })
  it('should convert map back to a list in data instance', async () => {
    expect(transformedBackDataInstance.value).toEqual(dataInstance.value)
    expect(
      isObjectType(transformedBackDataInstance.refType.type)
      && isObjectType(transformedBackDataInstance.refType.type.fields.classTranslationList.refType.type)
      && isListType(transformedBackDataInstance.refType.type.fields.classTranslationList.refType.type
        .fields.classTranslation.refType.type)
    ).toBeTruthy()
  })
  it('should convert map back to a list in type', () => {
    expect(transformedBackCustomRecordType.isEqual(customRecordType)).toBeTruthy()
  })
})
