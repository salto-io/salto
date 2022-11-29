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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { getFileCabinetTypes } from '../src/types/file_cabinet_types'
import { entitycustomfieldType } from '../src/autogen/types/standard_types/entitycustomfield'
import { CUSTOM_RECORD_TYPE, INTERNAL_ID, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../src/constants'
import { createElementsSourceIndex } from '../src/elements_source_index/elements_source_index'
import { workflowType } from '../src/autogen/types/standard_types/workflow'
import { convertFieldsTypesFromListToMap } from '../src/mapped_lists/utils'

const { awu } = collections.asynciterable

describe('createElementsSourceIndex', () => {
  const getAllMock = jest.fn()
  const getMock = jest.fn()
  const elementsSource = {
    getAll: getAllMock,
    get: getMock,
  } as unknown as ReadOnlyElementsSource
  const entitycustomfield = entitycustomfieldType().type

  const { file, folder } = getFileCabinetTypes()

  beforeEach(() => {
    getAllMock.mockReset()
    getMock.mockReset()
    getAllMock.mockImplementation(buildElementsSourceFromElements([]).getAll)
  })
  it('should create the index only once and cache it', async () => {
    const elementsSourceIndex = createElementsSourceIndex(elementsSource)
    const index = await elementsSourceIndex.getIndexes()
    const anotherIndex = await elementsSourceIndex.getIndexes()
    expect(index).toBe(anotherIndex)
    expect(getAllMock).toHaveBeenCalledTimes(1)
  })
  it('should create the right internal ids index', async () => {
    const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'someType') })
    getMock.mockImplementation(buildElementsSourceFromElements([
      type,
    ]).get)
    getAllMock.mockImplementation(buildElementsSourceFromElements([
      new InstanceElement(
        'name',
        type,
        { internalId: '4' },
      ),
      new InstanceElement(
        'name2',
        type,
        { internalId: '5', isSubInstance: true },
      ),
      type,
      new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        annotations: {
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          [SCRIPT_ID]: 'customrecord1',
          [INTERNAL_ID]: '2',
        },
      }),
    ]).getAll)

    const elementsSourceIndex = createElementsSourceIndex(elementsSource)
    const index = (await elementsSourceIndex.getIndexes()).internalIdsIndex
    expect(index).toEqual({
      'someType-4': new ElemID(NETSUITE, 'someType', 'instance', 'name'),
      'customrecordtype-2': new ElemID(NETSUITE, 'customrecord1'),
      '-123-2': new ElemID(NETSUITE, 'customrecord1'),
    })
  })

  it('should create the right custom fields index', async () => {
    const instance1 = new InstanceElement('name1', entitycustomfield, { appliestocontact: true, appliestocustomer: false, appliestoemployee: true })
    const instance2 = new InstanceElement('name2', entitycustomfield, { appliestocontact: true, appliestocustomer: false, appliestoemployee: false })
    getAllMock.mockImplementation(buildElementsSourceFromElements([
      instance1,
      instance2,
    ]).getAll)

    const elementsSourceIndex = createElementsSourceIndex(elementsSource)
    const index = (await elementsSourceIndex.getIndexes()).customFieldsIndex
    expect(index.Contact.map(e => e.elemID.getFullName())).toEqual([instance1, instance2]
      .map(e => e.elemID.getFullName()))

    expect(index.Employee.map(e => e.elemID.getFullName()))
      .toEqual([instance1.elemID.getFullName()])
  })

  it('should create the right pathToInternalIds index', async () => {
    const folderInstance = new InstanceElement('folder1', folder, { path: '/folder1', internalId: 0 })
    const fileInstance = new InstanceElement('file1', file, { path: '/folder1/file1', internalId: 1 })
    getAllMock.mockImplementation(buildElementsSourceFromElements([
      folderInstance,
      fileInstance,
    ]).getAll)

    expect((await createElementsSourceIndex(elementsSource).getIndexes()).pathToInternalIdsIndex)
      .toEqual({
        '/folder1': 0,
        '/folder1/file1': 1,
      })
  })

  it('should create the right elemIdToChangeByIndex index', async () => {
    const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'someType') })
    getAllMock.mockImplementation(buildElementsSourceFromElements([
      new InstanceElement(
        'inst',
        type,
        {},
        undefined,
        { [CORE_ANNOTATIONS.CHANGED_BY]: 'user name' }
      ),
      new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        annotations: {
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          [CORE_ANNOTATIONS.CHANGED_BY]: 'user name2',
        },
      }),
    ]).getAll)

    expect((await createElementsSourceIndex(elementsSource).getIndexes()).elemIdToChangeByIndex)
      .toEqual({
        'netsuite.someType.instance.inst': 'user name',
        'netsuite.customrecord1': 'user name2',
      })
  })
  it('should create the right mapKeyFieldsIndex index', async () => {
    const workflow = workflowType()
    const types = [workflow.type].concat(Object.values(workflow.innerTypes))
    await awu(types).forEach(async type => {
      await convertFieldsTypesFromListToMap(type)
    })
    getAllMock.mockImplementation(buildElementsSourceFromElements(types).getAll)

    expect((await createElementsSourceIndex(elementsSource).getIndexes()).mapKeyFieldsIndex)
      .toEqual({
        'netsuite.workflow_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowcustomfields.field.workflowcustomfield': 'scriptid',
        'netsuite.workflow_workflowcustomfields_workflowcustomfield_customfieldfilters.field.customfieldfilter': 'fldfilter',
        'netsuite.workflow_workflowcustomfields_workflowcustomfield_roleaccesses.field.roleaccess': 'role',
        'netsuite.workflow_workflowstates.field.workflowstate': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate.field.workflowactions': 'triggertype',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.addbuttonaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.confirmaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.createlineaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.createrecordaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.customaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.gotopageaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.gotorecordaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.initiateworkflowaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.lockrecordaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.removebuttonaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.returnusererroraction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.sendcampaignemailaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.sendemailaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.setdisplaylabelaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.setdisplaytypeaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.setfieldmandatoryaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.setfieldvalueaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.showmessageaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.subscribetorecordaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.transformrecordaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.workflowactiongroup': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions.field.workflowsublistactiongroup': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings.field.fieldsetting': 'targetfield',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings.field.fieldsetting': 'targetfield',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings.field.parametersetting': 'targetparameter',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings.field.fieldsetting': 'targetfield',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings.field.workflowfieldsetting': 'targetworkflowfield',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings.field.fieldsetting': 'targetfield',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.addbuttonaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.createlineaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.createrecordaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.customaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.gotopageaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.gotorecordaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.initiateworkflowaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.lockrecordaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.removebuttonaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.returnusererroraction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.sendcampaignemailaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.sendemailaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.setdisplaylabelaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.setdisplaytypeaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.setfieldmandatoryaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.setfieldvalueaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.subscribetorecordaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup.field.transformrecordaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings.field.fieldsetting': 'targetfield',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings.field.fieldsetting': 'targetfield',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings.field.parametersetting': 'targetparameter',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings.field.fieldsetting': 'targetfield',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings.field.workflowfieldsetting': 'targetworkflowfield',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings.field.fieldsetting': 'targetfield',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup.field.createrecordaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup.field.returnusererroraction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup.field.sendemailaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup.field.setfieldvalueaction': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings.field.fieldsetting': 'targetfield',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters.field.parameter': 'name',
        'netsuite.workflow_workflowstates_workflowstate_workflowstatecustomfields.field.workflowstatecustomfield': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters.field.customfieldfilter': 'fldfilter',
        'netsuite.workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses.field.roleaccess': 'role',
        'netsuite.workflow_workflowstates_workflowstate_workflowtransitions.field.workflowtransition': 'scriptid',
        'netsuite.workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters.field.parameter': 'name',
      })
  })
})
