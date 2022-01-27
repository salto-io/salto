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
import { convertFieldsTypesFromListToMap, convertInstanceMapsToLists, convertInstanceListsToMaps, getMappedLists, isMappedList } from '../../src/mapped_lists/utils'
import { workflowType } from '../../src/autogen/types/custom_types/workflow'
import { LIST_MAPPED_BY_FIELD, NETSUITE, SCRIPT_ID } from '../../src/constants'

const { awu } = collections.asynciterable

describe('mapped lists', () => {
  const workflow = workflowType()

  let instance: InstanceElement
  let transformedInstance: InstanceElement
  let transformedBackInstance: InstanceElement
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

    await awu(Object.values(workflow.innerTypes)).forEach(t => convertFieldsTypesFromListToMap(t))
    transformedInstance = instance.clone()
    transformedInstance.value = await convertInstanceListsToMaps(instance) ?? instance.value
    transformedBackInstance = await convertInstanceMapsToLists(transformedInstance)

    await awu(Object.values(workflow.innerTypes)).forEach(t => convertFieldsTypesFromListToMap(t))
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
          custworkflow2_index3: {
            scriptid: '[scriptid=custworkflow2]',
            index: 3,
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

  it('should not convert list if one of the items has no \'LIST_MAPPED_BY_FIELD\' field', async () => {
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
    expect(await convertInstanceListsToMaps(inst)).toEqual(inst.value)
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
          custworkflow2_index3: {
            scriptid: '[scriptid=custworkflow2]',
            index: 3,
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
  it('should convert map back to a list', () => {
    expect(transformedBackInstance.value).toEqual(instance.value)
  })
})
