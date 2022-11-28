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
import { collections } from '@salto-io/lowerdash'
import { BuiltinTypes, createRefToElmWithValue, ElemID, Field, FieldMap, InstanceElement, isListType, isMapType, ListType, MapType, ObjectType } from '@salto-io/adapter-api'
import { convertFieldsTypesFromListToMap, createConvertElementMapsToLists, convertInstanceListsToMaps, getMappedLists, isMappedList, validateTypesFieldMapping, convertAnnotationListsToMaps } from '../../src/mapped_lists/utils'
import { getStandardTypes } from '../../src/autogen/types'
import { LIST_MAPPED_BY_FIELD, NETSUITE, SCRIPT_ID } from '../../src/constants'
import { getInnerStandardTypes, getTopLevelStandardTypes } from '../../src/types'
import { LazyElementsSourceIndexes } from '../../src/elements_source_index/types'
import { toAnnotationRefTypes } from '../../src/custom_records/custom_record_type'

const { awu } = collections.asynciterable

describe('mapped lists', () => {
  const standardTypes = getStandardTypes()
  const { workflow, kpiscorecard, customrecordtype } = standardTypes

  let instance: InstanceElement
  let transformedInstance: InstanceElement
  let transformedBackInstance: InstanceElement
  let customRecordType: ObjectType
  let transformedCustomRecordType: ObjectType
  let transformedBackCustomRecordType: ObjectType
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
      annotationRefsOrTypes: await toAnnotationRefTypes(customrecordtype.type),
    })

    await awu([
      ...Object.values(workflow.innerTypes),
      ...Object.values(kpiscorecard.innerTypes),
      ...Object.values(customrecordtype.innerTypes),
    ])
      .forEach(t => convertFieldsTypesFromListToMap(t))

    transformedInstance = instance.clone()
    transformedInstance.value = await convertInstanceListsToMaps(instance) ?? instance.value
    transformedCustomRecordType = customRecordType.clone()
    transformedCustomRecordType.annotations = await convertAnnotationListsToMaps(customRecordType)

    const convertElementMapsToLists = await createConvertElementMapsToLists({ getIndexes: () => ({
      mapKeyFieldsIndex: {
        'netsuite.workflow_workflowcustomfields.field.workflowcustomfield': 'scriptid',
        'netsuite.workflow_workflowstates.field.workflowstate': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate.field.workflowactions': 'triggertype',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.setfieldvalueaction': 'scriptid',
        'netsuite.customrecordtype_permissions.field.permission': 'permittedrole',
      },
    }) } as unknown as LazyElementsSourceIndexes)
    transformedBackInstance = await convertElementMapsToLists(transformedInstance) as InstanceElement
    transformedBackCustomRecordType = await convertElementMapsToLists(transformedCustomRecordType) as ObjectType
  })

  describe('validateTypesFieldMapping', () => {
    const standardTypesAndInnerTypes = [
      ...getTopLevelStandardTypes(standardTypes),
      ...getInnerStandardTypes(standardTypes),
    ]
    it('should throw when missing some types with field mapping', async () => {
      const missingTypes = standardTypesAndInnerTypes
        .filter(element => element.elemID.name !== 'addressForm_mainFields_defaultFieldGroup_fields')
      await expect(async () => validateTypesFieldMapping(missingTypes)).rejects.toThrow('missing some types with field mapping')

      const typeWithMissingField = new ObjectType({
        elemID: new ElemID(NETSUITE, 'addressForm_mainFields_defaultFieldGroup_fields'),
        fields: {
          positions: {
            refType: createRefToElmWithValue(BuiltinTypes.STRING),
          },
        },
      })
      await expect(async () => validateTypesFieldMapping([...missingTypes, typeWithMissingField]))
        .rejects.toThrow('missing some types with field mapping')
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
  })

  it('should not modify ObjectTypes fields when types has no field to map by', async () => {
    const highlightings = kpiscorecard.innerTypes.kpiscorecard_highlightings
    expect(highlightings).toBeDefined()
    const { highlighting } = highlightings?.fields as FieldMap
    expect(isListType(await highlighting.getType())).toBeTruthy()
    expect(highlighting.annotations[LIST_MAPPED_BY_FIELD]).toBeUndefined()
  })

  it('should modify instance values', () => {
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

  it('should modify custom record type annotations', () => {
    expect(transformedCustomRecordType.annotations).toEqual({
      scriptid: 'customrecord1',
      permissions: {
        permission: {
          customrole1: {
            permittedlevel: 'EDIT',
            permittedrole: '[scriptid=customrole1]',
            index: 0,
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
      { path: new ElemID('netsuite', 'workflow', 'instance', 'instanceName', 'workflowcustomfields', 'workflowcustomfield'),
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
        } },
      { path: new ElemID('netsuite', 'workflow', 'instance', 'instanceName', 'workflowstates', 'workflowstate'),
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
        } },
      { path: new ElemID('netsuite', 'workflow', 'instance', 'instanceName', 'workflowstates', 'workflowstate', 'workflowstate1', 'workflowactions'),
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
        } },
      { path: new ElemID('netsuite', 'workflow', 'instance', 'instanceName', 'workflowstates', 'workflowstate', 'workflowstate1', 'workflowactions', 'ONENTRY', 'setfieldvalueaction'),
        value: {
          workflowaction1: {
            index: 0,
            scriptid: 'workflowaction1',
          },
          workflowaction2: {
            index: 1,
            scriptid: 'workflowaction2',
          },
        } },
      { path: new ElemID('netsuite', 'workflow', 'instance', 'instanceName', 'workflowstates', 'workflowstate', 'workflowstate1', 'workflowactions', 'BEFORELOAD', 'setfieldvalueaction'),
        value: {
          workflowaction3: {
            index: 0,
            scriptid: 'workflowaction3',
          },
          workflowaction4: {
            index: 1,
            scriptid: 'workflowaction4',
          },
        } },
    ])
  })
  it('should convert map back to a list in instance', () => {
    expect(transformedBackInstance.value).toEqual(instance.value)
  })
  it('should convert map back to a list in type', () => {
    expect(transformedBackCustomRecordType.isEqual(customRecordType)).toBeTruthy()
  })
})
