/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  ElemID,
  Element,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import NetsuiteClient from '../../src/client/client'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'
import { entitycustomfieldType } from '../../src/autogen/types/standard_types/entitycustomfield'
import {
  ACCOUNT_SPECIFIC_VALUE,
  CUSTOM_RECORD_TYPE,
  INIT_CONDITION,
  METADATA_TYPE,
  NAME_FIELD,
  NETSUITE,
  SCRIPT_ID,
  SELECT_RECORD_TYPE,
} from '../../src/constants'
import { INTERNAL_IDS_MAP, SUITEQL_TABLE } from '../../src/data_elements/suiteql_table_elements'
import filterCreator from '../../src/filters/workflow_account_specific_values'
import { RemoteFilterOpts } from '../../src/filter'
import { getUpdatedSuiteQLNameToInternalIdsMap } from '../../src/account_specific_values_resolver'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../utils'
import { getTypesToInternalId } from '../../src/data_elements/types'
import { NetsuiteConfig } from '../../src/config/types'

const runSavedSearchQueryMock = jest.fn()
const runRecordsQueryMock = jest.fn()
const runSuiteQLMock = jest.fn()
const client = {
  runSavedSearchQuery: runSavedSearchQueryMock,
  runRecordsQuery: runRecordsQueryMock,
  runSuiteQL: runSuiteQLMock,
} as unknown as NetsuiteClient

describe('workflow account specific values filter', () => {
  const { type: workflow } = workflowType()
  const { type: entitycustomfield } = entitycustomfieldType()
  const suiteQLTableType = new ObjectType({ elemID: new ElemID(NETSUITE, SUITEQL_TABLE) })

  let config: NetsuiteConfig
  let filterOpts: RemoteFilterOpts
  let workflowInstance1: InstanceElement
  let workflowInstance2: InstanceElement
  let suiteQLInstances: InstanceElement[]
  let customFieldInstance: InstanceElement
  let customRecordType: ObjectType

  const { internalIdToTypes, typeToInternalId } = getTypesToInternalId([])

  beforeEach(async () => {
    jest.clearAllMocks()
    customFieldInstance = new InstanceElement('entitycustomfield123', entitycustomfield, {
      [SCRIPT_ID]: 'entitycustomfield123',
      [SELECT_RECORD_TYPE]: '-4',
    })
    suiteQLInstances = [
      new InstanceElement('employee', suiteQLTableType, {
        [INTERNAL_IDS_MAP]: {
          '-1': { name: 'Salto user 1' },
          '-2': { name: 'Salto user 2' },
          '-3': { name: 'Salto user 3' },
          '-4': { name: 'Salto user 4' },
        },
      }),
      new InstanceElement('account', suiteQLTableType, {
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Account 1' },
          2: { name: 'Account 2' },
          3: { name: 'Account 3' },
          4: { name: 'Account 4' },
          5: { name: 'Account 5' },
          15: { name: 'Account 5' },
        },
      }),
      new InstanceElement('subsidiary', suiteQLTableType, {
        [INTERNAL_IDS_MAP]: {
          38: { name: 'Some Company' },
        },
      }),
      new InstanceElement('partner', suiteQLTableType),
      new InstanceElement('entityStatus', suiteQLTableType, {
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Entity Status 1' },
        },
      }),
    ]
    customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord123'),
      fields: {
        custom_field: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [SCRIPT_ID]: 'custom_field',
            [SELECT_RECORD_TYPE]: '-112',
          },
        },
      },
      annotations: {
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    config = await getDefaultAdapterConfig()
    filterOpts = {
      client,
      elementsSourceIndex: {
        getIndexes: () =>
          Promise.resolve({
            ...createEmptyElementsSourceIndexes(),
            customFieldsSelectRecordTypeIndex: {
              [customFieldInstance.elemID.getFullName()]: '-4',
            },
          }),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: true,
      config,
      internalIdToTypes,
      typeToInternalId,
    }
  })

  describe('on fetch', () => {
    let elements: Element[]

    beforeEach(() => {
      workflowInstance1 = new InstanceElement('customworkflow1', workflow, {
        [SCRIPT_ID]: 'customworkflow1',
        [NAME_FIELD]: 'Custom workflow 1',
        [INIT_CONDITION]: {
          formula:
            '"Subsidiary (Main):Default Account for Corporate Card Expenses" IN ("Account1","Account2","Account3","Account4","Account5","Account6") AND "Employee" IN ("Employee1") OR "User Role" IN ("Role1","Role2")',
          parameters: {
            parameter: {
              'Subsidiary__Main__Default_Account_for_Corporate_Card_Expenses@sjkfsssss': {
                name: 'Subsidiary (Main):Default Account for Corporate Card Expenses',
                value: 'STDBODYSUBSIDIARY:STDRECORDSUBSIDIARYDEFAULTACCTCORPCARDEXP',
              },
              Account1: {
                name: 'Account1',
                [SELECT_RECORD_TYPE]: '-112',
                value: ACCOUNT_SPECIFIC_VALUE,
              },
              Account2: {
                name: 'Account2',
                [SELECT_RECORD_TYPE]: '-112',
                value: ACCOUNT_SPECIFIC_VALUE,
              },
              Account3: {
                name: 'Account3',
                [SELECT_RECORD_TYPE]: '-112',
                value: ACCOUNT_SPECIFIC_VALUE,
              },
              Account4: {
                name: 'Account4',
                [SELECT_RECORD_TYPE]: '-112',
                value: ACCOUNT_SPECIFIC_VALUE,
              },
              Account5: {
                name: 'Account5',
                [SELECT_RECORD_TYPE]: '-112',
                value: ACCOUNT_SPECIFIC_VALUE,
              },
              Account6: {
                name: 'Account6',
                [SELECT_RECORD_TYPE]: '-112',
                value: ACCOUNT_SPECIFIC_VALUE,
              },
              Employee: {
                name: 'Employee',
                value: 'STDBODYEMPLOYEE',
              },
              Employee1: {
                name: 'Employee1',
                [SELECT_RECORD_TYPE]: '-4',
                value: ACCOUNT_SPECIFIC_VALUE,
              },
              'User_Role@s': {
                name: 'User Role',
                value: 'STDUSERROLE',
              },
              Role1: {
                name: 'Role1',
                [SELECT_RECORD_TYPE]: '-118',
                value: new ReferenceExpression(new ElemID(NETSUITE, 'role', 'instance', 'customrole123')),
              },
              Role2: {
                name: 'Role2',
                [SELECT_RECORD_TYPE]: '-118',
                value: 'ADMINISTRATOR',
              },
            },
          },
        },
        workflowcustomfields: {
          workflowcustomfield: {
            custworkflow1: {
              [SCRIPT_ID]: 'custworkflow1',
              [SELECT_RECORD_TYPE]: new ReferenceExpression(
                customRecordType.elemID.createNestedID('field', 'custom_field', SCRIPT_ID),
              ),
              defaultvalue: ACCOUNT_SPECIFIC_VALUE,
            },
            custworkflow2: {
              [SCRIPT_ID]: 'custworkflow2',
              [SELECT_RECORD_TYPE]: '-104',
              defaultvalue: ACCOUNT_SPECIFIC_VALUE,
            },
          },
        },
        workflowstates: {
          workflowstate: {
            workflowstate118: {
              [SCRIPT_ID]: 'workflowstate118',
              workflowactions: {
                ONENTRY: {
                  setfieldvalueaction: {
                    workflowaction166: {
                      [SCRIPT_ID]: 'workflowaction166',
                      [SELECT_RECORD_TYPE]: new ReferenceExpression(
                        customRecordType.elemID.createNestedID('attr', SCRIPT_ID),
                      ),
                      defaultvalue: ACCOUNT_SPECIFIC_VALUE,
                    },
                    workflowaction167: {
                      [SCRIPT_ID]: 'workflowaction167',
                      resultfield: new ReferenceExpression(
                        new ElemID(
                          NETSUITE,
                          'workflow',
                          'instance',
                          'customworkflow1',
                          'workflowcustomfields',
                          'workflowcustomfield',
                          'custworkflow1',
                          SCRIPT_ID,
                        ),
                      ),
                      defaultvalue: ACCOUNT_SPECIFIC_VALUE,
                    },
                  },
                  sendemailaction: {
                    workflowaction224: {
                      [SCRIPT_ID]: 'workflowaction224',
                      field: 'UNKNOWN',
                      defaultvalue: ACCOUNT_SPECIFIC_VALUE,
                      [INIT_CONDITION]: {
                        formula: '"User Role" IN ("Role1")',
                        parameters: {
                          parameter: {
                            'User_Role@s': {
                              name: 'User Role',
                              value: 'STDUSERROLE',
                            },
                            Role1: {
                              name: 'Role1',
                              [SELECT_RECORD_TYPE]: '-118',
                              value: '[scriptid=customrole123]',
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
      workflowInstance2 = new InstanceElement('customworkflow2', workflow, {
        [SCRIPT_ID]: 'customworkflow2',
        [NAME_FIELD]: 'Custom workflow 2',
        workflowstates: {
          workflowstate: {
            workflowstate18: {
              [SCRIPT_ID]: 'workflowstate18',
              workflowactions: {
                ONENTRY: {
                  setfieldvalueaction: {
                    workflowaction66: {
                      [SCRIPT_ID]: 'workflowaction66',
                      [INIT_CONDITION]: {
                        formula:
                          '((( "Total" > "0.0" AND "Preferred Language" IN ("Language1","Language2","Language3") AND "Type" IN ("Transaction Type1") AND "Employee" IN ("Employee2") ) OR ( "Type" IN ("Transaction Type1") AND "Preferred Language" IN ("Language2","Language1","Language3") ) AND "Employee" IN ("Employee2") ) AND "Subsidiary (Main)" IN ("{#Subsidiary#}1") )',
                        parameters: {
                          parameter: {
                            'Preferred_Language@s': {
                              name: 'Preferred Language',
                              value: '[scriptid=custbody_rsm_klp_preferred_language]',
                            },
                            Language1: {
                              name: 'Language1',
                              [SELECT_RECORD_TYPE]: '-224',
                              value: '2',
                            },
                            Language2: {
                              name: 'Language2',
                              [SELECT_RECORD_TYPE]: '-224',
                              value: '13',
                            },
                            Language3: {
                              name: 'Language3',
                              [SELECT_RECORD_TYPE]: '-224',
                              value: '60',
                            },
                            Type: {
                              name: 'Type',
                              value: 'STDBODYTRANTYPE',
                            },
                            'Transaction_Type1@s': {
                              name: 'Transaction Type1',
                              [SELECT_RECORD_TYPE]: '-100',
                              value: 'INVOICE',
                            },
                            Employee: {
                              name: 'Employee',
                              value: 'STDBODYEMPLOYEE',
                            },
                            Employee2: {
                              name: 'Employee2',
                              [SELECT_RECORD_TYPE]: '-4',
                              value: ACCOUNT_SPECIFIC_VALUE,
                            },
                            'Subsidiary__Main_@sjk': {
                              name: 'Subsidiary (Main)',
                              value: 'STDBODYSUBSIDIARY',
                            },
                            '__Subsidiary__1@_00123nn_00125': {
                              name: '{#Subsidiary#}1',
                              [SELECT_RECORD_TYPE]: '-117',
                              value: ACCOUNT_SPECIFIC_VALUE,
                            },
                          },
                        },
                      },
                    },
                  },
                  sendemailaction: {
                    workflowaction124: {
                      [SCRIPT_ID]: 'workflowaction124',
                      field: 'STDBODYACCOUNT',
                      defaultvalue: ACCOUNT_SPECIFIC_VALUE,
                      valuemultiselect: ACCOUNT_SPECIFIC_VALUE,
                      recipient: ACCOUNT_SPECIFIC_VALUE,
                      sender: ACCOUNT_SPECIFIC_VALUE,
                    },
                  },
                },
              },
              workflowstatecustomfields: {
                workflowstatecustomfield: {
                  custwfstate2: {
                    [SCRIPT_ID]: 'custwfstate2',
                    field: new ReferenceExpression(customFieldInstance.elemID.createNestedID(SCRIPT_ID)),
                    defaultvalue: ACCOUNT_SPECIFIC_VALUE,
                  },
                },
              },
            },
          },
        },
      })
      elements = [workflowInstance1, workflowInstance2, ...suiteQLInstances, customRecordType]
    })
    describe('successful call', () => {
      beforeEach(async () => {
        runSavedSearchQueryMock.mockResolvedValue([{ internalid: [{ value: '3' }] }, { internalid: [{ value: '5' }] }])
        runRecordsQueryMock.mockResolvedValue([
          {
            body: {
              [SCRIPT_ID]: 'customworkflow1',
              initconditionformula:
                '{subsidiary} in (1,2,3,4,5,6) AND {employee}=-1 or {role} in (4,3) or {custom_123}="1"',
            },
            sublists: [
              {
                body: {
                  [SCRIPT_ID]: 'custworkflow1',
                  defaultvalue: '5',
                },
                sublists: [],
              },
              {
                body: {
                  [SCRIPT_ID]: 'custworkflow2',
                  defaultvalue: '1',
                },
                sublists: [],
              },
              {
                body: {
                  [SCRIPT_ID]: 'workflowstate118',
                },
                sublists: [
                  {
                    body: {
                      [SCRIPT_ID]: 'workflowaction167',
                      defaultvalue: '3',
                    },
                    sublists: [],
                  },
                ],
              },
            ],
          },
          {
            body: {
              [SCRIPT_ID]: 'customworkflow2',
              initconditionformula: '',
            },
            sublists: [
              {
                body: {
                  [SCRIPT_ID]: 'workflowstate18',
                },
                sublists: [
                  {
                    body: {
                      [SCRIPT_ID]: 'workflowaction66',
                      conditionformula:
                        "((({total} > '0.0' and {custbody_rsm_klp_preferred_language.id} in (2,13,60) and UPPER({type.id})=UPPER('CustInvc') and {employee}=-2) or (UPPER({type.id})=UPPER('CustInvc') and {custbody_rsm_klp_preferred_language.id} in (13,2,60)) {employee}=-2) and {subsidiary.id}=38)",
                    },
                    sublists: [],
                  },
                  {
                    body: {
                      [SCRIPT_ID]: 'workflowaction124',
                      conditionformula: '',
                      defaultvalue: '5',
                      valuemultiselect: ['4'],
                      sender: '-3',
                      recipient: '-4',
                    },
                    sublists: [],
                  },
                  {
                    body: {
                      [SCRIPT_ID]: 'custwfstate2',
                      defaultvalue: '-1',
                    },
                    sublists: [],
                  },
                ],
              },
            ],
          },
        ])
        runSuiteQLMock.mockResolvedValue([])
        await filterCreator(filterOpts).onFetch?.(elements)
      })
      it('should call runSavedSearchQuery with right params', () => {
        expect(runSavedSearchQueryMock).toHaveBeenCalledWith({
          type: 'workflow',
          columns: ['internalid'],
          filters: [['name', 'is', 'Custom workflow 1'], 'OR', ['name', 'is', 'Custom workflow 2']],
        })
      })
      it('should call runRecordsQuery with right params', () => {
        expect(runRecordsQueryMock).toHaveBeenCalledWith(['3', '5'], {
          type: 'workflow',
          fields: ['scriptid', 'initconditionformula'],
          filter: {
            fieldId: 'scriptid',
            in: ['customworkflow1', 'customworkflow2'],
          },
          sublists: [
            {
              type: 'workflowstate',
              fields: ['scriptid'],
              filter: {
                fieldId: 'scriptid',
                in: ['workflowstate118', 'workflowstate18'],
              },
              idAlias: 'stateid',
              sublistId: 'states',
              sublists: [
                {
                  type: 'actiontype',
                  idAlias: 'actionid',
                  sublistId: 'actions',
                  typeSuffix: 'action',
                  customTypes: { customactionaction: 'customaction' },
                  fields: ['scriptid', 'defaultvalue', 'conditionformula', 'valuemultiselect', 'recipient', 'sender'],
                  filter: {
                    fieldId: 'scriptid',
                    in: ['workflowaction167', 'workflowaction66', 'workflowaction124'],
                  },
                },
                {
                  type: 'workflowstatecustomfield',
                  sublistId: 'fields',
                  idAlias: 'id',
                  fields: ['scriptid', 'defaultvalue'],
                  filter: {
                    fieldId: 'scriptid',
                    in: ['custwfstate2'],
                  },
                },
              ],
            },
            {
              type: 'workflowcustomfield',
              sublistId: 'fields',
              idAlias: 'id',
              fields: ['scriptid', 'defaultvalue'],
              filter: {
                fieldId: 'scriptid',
                in: ['custworkflow1', 'custworkflow2'],
              },
            },
          ],
        })
      })
      it('should resolve account specific values', () => {
        expect(workflowInstance1.value).toEqual({
          [SCRIPT_ID]: 'customworkflow1',
          [NAME_FIELD]: 'Custom workflow 1',
          [INIT_CONDITION]: {
            formula:
              '"Subsidiary (Main):Default Account for Corporate Card Expenses" IN ("Account1","Account2","Account3","Account4","Account5","Account6") AND "Employee" IN ("Employee1") OR "User Role" IN ("Role1","Role2")',
            parameters: {
              parameter: {
                'Subsidiary__Main__Default_Account_for_Corporate_Card_Expenses@sjkfsssss': {
                  name: 'Subsidiary (Main):Default Account for Corporate Card Expenses',
                  value: 'STDBODYSUBSIDIARY:STDRECORDSUBSIDIARYDEFAULTACCTCORPCARDEXP',
                },
                Account1: {
                  name: 'Account1',
                  [SELECT_RECORD_TYPE]: '-112',
                  value: `${ACCOUNT_SPECIFIC_VALUE} (Account 1)`,
                },
                Account2: {
                  name: 'Account2',
                  [SELECT_RECORD_TYPE]: '-112',
                  value: `${ACCOUNT_SPECIFIC_VALUE} (Account 2)`,
                },
                Account3: {
                  name: 'Account3',
                  [SELECT_RECORD_TYPE]: '-112',
                  value: `${ACCOUNT_SPECIFIC_VALUE} (Account 3)`,
                },
                Account4: {
                  name: 'Account4',
                  [SELECT_RECORD_TYPE]: '-112',
                  value: `${ACCOUNT_SPECIFIC_VALUE} (Account 4)`,
                },
                Account5: {
                  name: 'Account5',
                  [SELECT_RECORD_TYPE]: '-112',
                  value: `${ACCOUNT_SPECIFIC_VALUE} (Account 5)`,
                },
                Account6: {
                  name: 'Account6',
                  [SELECT_RECORD_TYPE]: '-112',
                  // should not be resolved - no internal id is 6
                  value: ACCOUNT_SPECIFIC_VALUE,
                },
                Employee: {
                  name: 'Employee',
                  value: 'STDBODYEMPLOYEE',
                },
                Employee1: {
                  name: 'Employee1',
                  [SELECT_RECORD_TYPE]: '-4',
                  value: `${ACCOUNT_SPECIFIC_VALUE} (Salto user 1)`,
                },
                'User_Role@s': {
                  name: 'User Role',
                  value: 'STDUSERROLE',
                },
                Role1: {
                  name: 'Role1',
                  [SELECT_RECORD_TYPE]: '-118',
                  value: new ReferenceExpression(new ElemID(NETSUITE, 'role', 'instance', 'customrole123')),
                },
                Role2: {
                  name: 'Role2',
                  [SELECT_RECORD_TYPE]: '-118',
                  value: 'ADMINISTRATOR',
                },
              },
            },
          },
          workflowcustomfields: {
            workflowcustomfield: {
              custworkflow1: {
                [SCRIPT_ID]: 'custworkflow1',
                [SELECT_RECORD_TYPE]: new ReferenceExpression(
                  customRecordType.elemID.createNestedID('field', 'custom_field', SCRIPT_ID),
                ),
                defaultvalue: `${ACCOUNT_SPECIFIC_VALUE} (Account 5)`,
              },
              custworkflow2: {
                [SCRIPT_ID]: 'custworkflow2',
                [SELECT_RECORD_TYPE]: '-104',
                defaultvalue: `${ACCOUNT_SPECIFIC_VALUE} (Entity Status 1)`,
              },
            },
          },
          workflowstates: {
            workflowstate: {
              workflowstate118: {
                [SCRIPT_ID]: 'workflowstate118',
                workflowactions: {
                  ONENTRY: {
                    setfieldvalueaction: {
                      workflowaction166: {
                        [SCRIPT_ID]: 'workflowaction166',
                        [SELECT_RECORD_TYPE]: new ReferenceExpression(
                          customRecordType.elemID.createNestedID('attr', SCRIPT_ID),
                        ),
                        // should not resolve - there is no suiteql table instnace for custom record types
                        defaultvalue: ACCOUNT_SPECIFIC_VALUE,
                      },
                      workflowaction167: {
                        [SCRIPT_ID]: 'workflowaction167',
                        resultfield: new ReferenceExpression(
                          workflowInstance1.elemID.createNestedID(
                            'workflowcustomfields',
                            'workflowcustomfield',
                            'custworkflow1',
                            SCRIPT_ID,
                          ),
                        ),
                        defaultvalue: `${ACCOUNT_SPECIFIC_VALUE} (Account 3)`,
                      },
                    },
                    sendemailaction: {
                      workflowaction224: {
                        [SCRIPT_ID]: 'workflowaction224',
                        field: 'UNKNOWN',
                        // should not resolve - field is UNKNOWN
                        defaultvalue: ACCOUNT_SPECIFIC_VALUE,
                        [INIT_CONDITION]: {
                          formula: '"User Role" IN ("Role1")',
                          parameters: {
                            parameter: {
                              'User_Role@s': {
                                name: 'User Role',
                                value: 'STDUSERROLE',
                              },
                              Role1: {
                                name: 'Role1',
                                [SELECT_RECORD_TYPE]: '-118',
                                value: '[scriptid=customrole123]',
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        })
        expect(workflowInstance2.value).toEqual({
          [SCRIPT_ID]: 'customworkflow2',
          [NAME_FIELD]: 'Custom workflow 2',
          workflowstates: {
            workflowstate: {
              workflowstate18: {
                [SCRIPT_ID]: 'workflowstate18',
                workflowactions: {
                  ONENTRY: {
                    setfieldvalueaction: {
                      workflowaction66: {
                        [SCRIPT_ID]: 'workflowaction66',
                        [INIT_CONDITION]: {
                          formula:
                            '((( "Total" > "0.0" AND "Preferred Language" IN ("Language1","Language2","Language3") AND "Type" IN ("Transaction Type1") AND "Employee" IN ("Employee2") ) OR ( "Type" IN ("Transaction Type1") AND "Preferred Language" IN ("Language2","Language1","Language3") ) AND "Employee" IN ("Employee2") ) AND "Subsidiary (Main)" IN ("{#Subsidiary#}1") )',
                          parameters: {
                            parameter: {
                              'Preferred_Language@s': {
                                name: 'Preferred Language',
                                value: '[scriptid=custbody_rsm_klp_preferred_language]',
                              },
                              Language1: {
                                name: 'Language1',
                                [SELECT_RECORD_TYPE]: '-224',
                                value: '2',
                              },
                              Language2: {
                                name: 'Language2',
                                [SELECT_RECORD_TYPE]: '-224',
                                value: '13',
                              },
                              Language3: {
                                name: 'Language3',
                                [SELECT_RECORD_TYPE]: '-224',
                                value: '60',
                              },
                              Type: {
                                name: 'Type',
                                value: 'STDBODYTRANTYPE',
                              },
                              'Transaction_Type1@s': {
                                name: 'Transaction Type1',
                                [SELECT_RECORD_TYPE]: '-100',
                                value: 'INVOICE',
                              },
                              Employee: {
                                name: 'Employee',
                                value: 'STDBODYEMPLOYEE',
                              },
                              Employee2: {
                                name: 'Employee2',
                                [SELECT_RECORD_TYPE]: '-4',
                                value: `${ACCOUNT_SPECIFIC_VALUE} (Salto user 2)`,
                              },
                              'Subsidiary__Main_@sjk': {
                                name: 'Subsidiary (Main)',
                                value: 'STDBODYSUBSIDIARY',
                              },
                              '__Subsidiary__1@_00123nn_00125': {
                                name: '{#Subsidiary#}1',
                                [SELECT_RECORD_TYPE]: '-117',
                                value: `${ACCOUNT_SPECIFIC_VALUE} (Some Company)`,
                              },
                            },
                          },
                        },
                      },
                    },
                    sendemailaction: {
                      workflowaction124: {
                        [SCRIPT_ID]: 'workflowaction124',
                        field: 'STDBODYACCOUNT',
                        defaultvalue: `${ACCOUNT_SPECIFIC_VALUE} (Account 5)`,
                        valuemultiselect: `${ACCOUNT_SPECIFIC_VALUE} (Account 4)`,
                        recipient: `${ACCOUNT_SPECIFIC_VALUE} (Salto user 4)`,
                        sender: `${ACCOUNT_SPECIFIC_VALUE} (Salto user 3)`,
                      },
                    },
                  },
                },
                workflowstatecustomfields: {
                  workflowstatecustomfield: {
                    custwfstate2: {
                      [SCRIPT_ID]: 'custwfstate2',
                      field: new ReferenceExpression(customFieldInstance.elemID.createNestedID(SCRIPT_ID)),
                      defaultvalue: `${ACCOUNT_SPECIFIC_VALUE} (Salto user 1)`,
                    },
                  },
                },
              },
            },
          },
        })
      })
    })
    describe('with errors', () => {
      let originalWorkflowInstance1: InstanceElement
      let originalWorkflowInstance2: InstanceElement
      beforeEach(() => {
        originalWorkflowInstance1 = workflowInstance1.clone()
        originalWorkflowInstance2 = workflowInstance2.clone()
      })
      it('should not run records query when internal ids query fail', async () => {
        runSavedSearchQueryMock.mockResolvedValue(undefined)
        await filterCreator(filterOpts).onFetch?.(elements)
        expect(runRecordsQueryMock).not.toHaveBeenCalled()
        expect(workflowInstance1.value).toEqual(originalWorkflowInstance1.value)
        expect(workflowInstance2.value).toEqual(originalWorkflowInstance2.value)
      })
      it('should not resolve account specific values when record query result has no data', async () => {
        runSavedSearchQueryMock.mockResolvedValue([{ internalid: [{ value: '3' }] }, { internalid: [{ value: '5' }] }])
        runRecordsQueryMock.mockResolvedValue([
          {
            body: {
              [SCRIPT_ID]: 'customworkflow1',
              initconditionformula: '',
            },
            sublists: [],
          },
        ])
        await filterCreator(filterOpts).onFetch?.(elements)
        expect(workflowInstance1.value).toEqual(originalWorkflowInstance1.value)
        expect(workflowInstance2.value).toEqual(originalWorkflowInstance2.value)
      })
      it('should not run filter when there are no suiteql instances', async () => {
        await filterCreator(filterOpts).onFetch?.(elements.filter(e => e.elemID.typeName !== SUITEQL_TABLE))
        expect(runSavedSearchQueryMock).not.toHaveBeenCalled()
        expect(runRecordsQueryMock).not.toHaveBeenCalled()
      })
      it('should not run filter when there are no unresolved workflows', async () => {
        workflowInstance1.value = {
          [SCRIPT_ID]: 'customworkflow1',
        }
        workflowInstance2.value = {
          [SCRIPT_ID]: 'customworkflow2',
        }
        await filterCreator(filterOpts).onFetch?.(elements)
        expect(runSavedSearchQueryMock).not.toHaveBeenCalled()
        expect(runRecordsQueryMock).not.toHaveBeenCalled()
      })
    })
  })

  describe('pre deploy', () => {
    beforeEach(async () => {
      workflowInstance1 = new InstanceElement('customworkflow1', workflow, {
        [SCRIPT_ID]: 'customworkflow1',
        [NAME_FIELD]: 'Custom workflow 1',
        [INIT_CONDITION]: {
          formula:
            '"Subsidiary (Main):Default Account for Corporate Card Expenses" IN ("Account1","Account2","Account3","Account4","Account5","Account6") AND "Employee" IN ("Employee1") OR "User Role" IN ("Role1")',
          parameters: {
            parameter: {
              'Subsidiary__Main__Default_Account_for_Corporate_Card_Expenses@sjkfsssss': {
                name: 'Subsidiary (Main):Default Account for Corporate Card Expenses',
                value: 'STDBODYSUBSIDIARY:STDRECORDSUBSIDIARYDEFAULTACCTCORPCARDEXP',
              },
              Account1: {
                name: 'Account1',
                [SELECT_RECORD_TYPE]: '-112',
                value: `${ACCOUNT_SPECIFIC_VALUE} (Account 1)`,
              },
              Account2: {
                name: 'Account2',
                [SELECT_RECORD_TYPE]: '-112',
                value: `${ACCOUNT_SPECIFIC_VALUE} (Account 2)`,
              },
              Account3: {
                name: 'Account3',
                [SELECT_RECORD_TYPE]: '-112',
                value: `${ACCOUNT_SPECIFIC_VALUE} (Account 3)`,
              },
              Account4: {
                name: 'Account4',
                [SELECT_RECORD_TYPE]: '-112',
                value: `${ACCOUNT_SPECIFIC_VALUE} (Account 4)`,
              },
              Account5: {
                name: 'Account5',
                [SELECT_RECORD_TYPE]: '-112',
                value: `${ACCOUNT_SPECIFIC_VALUE} (Account 5)`,
              },
              Account6: {
                name: 'Account6',
                [SELECT_RECORD_TYPE]: '-112',
                value: `${ACCOUNT_SPECIFIC_VALUE} (Account 6)`,
              },
              Employee: {
                name: 'Employee',
                value: 'STDBODYEMPLOYEE',
              },
              Employee1: {
                name: 'Employee1',
                [SELECT_RECORD_TYPE]: '-4',
                value: `${ACCOUNT_SPECIFIC_VALUE} (Salto user 1)`,
              },
              'User_Role@s': {
                name: 'User Role',
                value: 'STDUSERROLE',
              },
              Role1: {
                name: 'Role1',
                [SELECT_RECORD_TYPE]: '-118',
                value: '[scriptid=customrole123]',
              },
              Role2: {
                name: 'Role2',
                [SELECT_RECORD_TYPE]: '-118',
                value: 'ADMINISTRATOR',
              },
            },
          },
        },
        workflowcustomfields: {
          workflowcustomfield: {
            custworkflow1: {
              [SCRIPT_ID]: 'custworkflow1',
              [SELECT_RECORD_TYPE]: new ReferenceExpression(
                customRecordType.elemID.createNestedID('field', 'custom_field', SCRIPT_ID),
                customRecordType.fields.custom_field.annotations[SCRIPT_ID],
                customRecordType,
              ),
              defaultvalue: `${ACCOUNT_SPECIFIC_VALUE} (Account 5)`,
            },
            custworkflow2: {
              [SCRIPT_ID]: 'custworkflow2',
              [SELECT_RECORD_TYPE]: '-104',
              defaultvalue: `${ACCOUNT_SPECIFIC_VALUE} (Entity Status 1)`,
            },
          },
        },
        workflowstates: {
          workflowstate: {
            workflowstate118: {
              [SCRIPT_ID]: 'workflowstate118',
              workflowactions: {
                ONENTRY: {
                  setfieldvalueaction: {
                    workflowaction166: {
                      [SCRIPT_ID]: 'workflowaction166',
                      [SELECT_RECORD_TYPE]: new ReferenceExpression(
                        customRecordType.elemID.createNestedID('attr', SCRIPT_ID),
                        customRecordType.annotations[SCRIPT_ID],
                        customRecordType,
                      ),
                      // should not resolve - there is no suiteql table instnace for custom record types
                      defaultvalue: ACCOUNT_SPECIFIC_VALUE,
                    },
                    workflowaction167: {
                      [SCRIPT_ID]: 'workflowaction167',
                      resultfield: new ReferenceExpression(
                        workflowInstance1.elemID.createNestedID(
                          'workflowcustomfields',
                          'workflowcustomfield',
                          'custworkflow1',
                          SCRIPT_ID,
                        ),
                      ),
                      defaultvalue: `${ACCOUNT_SPECIFIC_VALUE} (Account 3)`,
                    },
                  },
                  sendemailaction: {
                    workflowaction224: {
                      [SCRIPT_ID]: 'workflowaction224',
                      field: 'UNKNOWN',
                      // should not resolve - field is UNKNOWN
                      defaultvalue: ACCOUNT_SPECIFIC_VALUE,
                      [INIT_CONDITION]: {
                        formula: '"User Role" IN ("Role1")',
                        parameters: {
                          parameter: {
                            'User_Role@s': {
                              name: 'User Role',
                              value: 'STDUSERROLE',
                            },
                            Role1: {
                              name: 'Role1',
                              [SELECT_RECORD_TYPE]: '-118',
                              value: '[scriptid=customrole123]',
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
      workflowInstance2 = new InstanceElement('customworkflow2', workflow, {
        [SCRIPT_ID]: 'customworkflow2',
        [NAME_FIELD]: 'Custom workflow 2',
        workflowstates: {
          workflowstate: {
            workflowstate18: {
              [SCRIPT_ID]: 'workflowstate18',
              workflowactions: {
                ONENTRY: {
                  setfieldvalueaction: {
                    workflowaction66: {
                      [SCRIPT_ID]: 'workflowaction66',
                      [INIT_CONDITION]: {
                        formula:
                          '((( "Total" > "0.0" AND "Preferred Language" IN ("Language1","Language2","Language3") AND "Type" IN ("Transaction Type1") AND "Employee" IN ("Employee2") ) OR ( "Type" IN ("Transaction Type1") AND "Preferred Language" IN ("Language2","Language1","Language3") ) AND "Employee" IN ("Employee2") ) AND "Subsidiary (Main)" IN ("{#Subsidiary#}1") )',
                        parameters: {
                          parameter: {
                            'Preferred_Language@s': {
                              name: 'Preferred Language',
                              value: '[scriptid=custbody_rsm_klp_preferred_language]',
                            },
                            Language1: {
                              name: 'Language1',
                              [SELECT_RECORD_TYPE]: '-224',
                              value: '2',
                            },
                            Language2: {
                              name: 'Language2',
                              [SELECT_RECORD_TYPE]: '-224',
                              value: '13',
                            },
                            Language3: {
                              name: 'Language3',
                              [SELECT_RECORD_TYPE]: '-224',
                              value: '60',
                            },
                            Type: {
                              name: 'Type',
                              value: 'STDBODYTRANTYPE',
                            },
                            'Transaction_Type1@s': {
                              name: 'Transaction Type1',
                              [SELECT_RECORD_TYPE]: '-100',
                              value: 'INVOICE',
                            },
                            Employee: {
                              name: 'Employee',
                              value: 'STDBODYEMPLOYEE',
                            },
                            Employee2: {
                              name: 'Employee2',
                              [SELECT_RECORD_TYPE]: '-4',
                              value: `${ACCOUNT_SPECIFIC_VALUE} (Salto user 2)`,
                            },
                            'Subsidiary__Main_@sjk': {
                              name: 'Subsidiary (Main)',
                              value: 'STDBODYSUBSIDIARY',
                            },
                            '__Subsidiary__1@_00123nn_00125': {
                              name: '{#Subsidiary#}1',
                              [SELECT_RECORD_TYPE]: '-117',
                              value: `${ACCOUNT_SPECIFIC_VALUE} (Some Company)`,
                            },
                          },
                        },
                      },
                    },
                  },
                  sendemailaction: {
                    workflowaction124: {
                      [SCRIPT_ID]: 'workflowaction124',
                      field: 'STDBODYACCOUNT',
                      defaultvalue: `${ACCOUNT_SPECIFIC_VALUE} (Account 5)`,
                      recipient: `${ACCOUNT_SPECIFIC_VALUE} (Salto user 4)`,
                      sender: `${ACCOUNT_SPECIFIC_VALUE} (Salto user 3)`,
                    },
                  },
                },
              },
              workflowstatecustomfields: {
                workflowstatecustomfield: {
                  custwfstate2: {
                    [SCRIPT_ID]: 'custwfstate2',
                    field: new ReferenceExpression(
                      customFieldInstance.elemID.createNestedID(SCRIPT_ID),
                      customFieldInstance.value[SCRIPT_ID],
                      customFieldInstance,
                    ),
                    defaultvalue: `${ACCOUNT_SPECIFIC_VALUE} (Salto user 1)`,
                  },
                },
              },
            },
          },
        },
      })
      const changes = [toChange({ after: workflowInstance1 }), toChange({ after: workflowInstance2 })]
      const suiteQLNameToInternalIdsMap = await getUpdatedSuiteQLNameToInternalIdsMap(
        client,
        config,
        buildElementsSourceFromElements(suiteQLInstances),
        changes,
        internalIdToTypes,
      )
      await filterCreator({ ...filterOpts, suiteQLNameToInternalIdsMap }).preDeploy?.(changes)
    })
    it('should resolve account specific values', () => {
      expect(workflowInstance1.value).toEqual({
        [SCRIPT_ID]: 'customworkflow1',
        [NAME_FIELD]: 'Custom workflow 1',
        [INIT_CONDITION]: {
          formula:
            '"Subsidiary (Main):Default Account for Corporate Card Expenses" IN ("Account1","Account2","Account3","Account4","Account5","Account6") AND "Employee" IN ("Employee1") OR "User Role" IN ("Role1")',
          parameters: {
            parameter: {
              'Subsidiary__Main__Default_Account_for_Corporate_Card_Expenses@sjkfsssss': {
                name: 'Subsidiary (Main):Default Account for Corporate Card Expenses',
                value: 'STDBODYSUBSIDIARY:STDRECORDSUBSIDIARYDEFAULTACCTCORPCARDEXP',
              },
              Account1: {
                name: 'Account1',
                [SELECT_RECORD_TYPE]: '-112',
                value: '1',
              },
              Account2: {
                name: 'Account2',
                [SELECT_RECORD_TYPE]: '-112',
                value: '2',
              },
              Account3: {
                name: 'Account3',
                [SELECT_RECORD_TYPE]: '-112',
                value: '3',
              },
              Account4: {
                name: 'Account4',
                [SELECT_RECORD_TYPE]: '-112',
                value: '4',
              },
              Account5: {
                name: 'Account5',
                [SELECT_RECORD_TYPE]: '-112',
                value: '5',
              },
              Account6: {
                name: 'Account6',
                [SELECT_RECORD_TYPE]: '-112',
                // should not be resolved - no internal id match "Account 6"
                value: ACCOUNT_SPECIFIC_VALUE,
              },
              Employee: {
                name: 'Employee',
                value: 'STDBODYEMPLOYEE',
              },
              Employee1: {
                name: 'Employee1',
                [SELECT_RECORD_TYPE]: '-4',
                value: '-1',
              },
              'User_Role@s': {
                name: 'User Role',
                value: 'STDUSERROLE',
              },
              Role1: {
                name: 'Role1',
                [SELECT_RECORD_TYPE]: '-118',
                value: '[scriptid=customrole123]',
              },
              Role2: {
                name: 'Role2',
                [SELECT_RECORD_TYPE]: '-118',
                value: 'ADMINISTRATOR',
              },
            },
          },
        },
        workflowcustomfields: {
          workflowcustomfield: {
            custworkflow1: {
              [SCRIPT_ID]: 'custworkflow1',
              [SELECT_RECORD_TYPE]: new ReferenceExpression(
                customRecordType.elemID.createNestedID('field', 'custom_field', SCRIPT_ID),
                customRecordType.fields.custom_field.annotations[SCRIPT_ID],
                customRecordType,
              ),
              defaultvalue: '5',
            },
            custworkflow2: {
              [SCRIPT_ID]: 'custworkflow2',
              [SELECT_RECORD_TYPE]: '-104',
              defaultvalue: '1',
            },
          },
        },
        workflowstates: {
          workflowstate: {
            workflowstate118: {
              [SCRIPT_ID]: 'workflowstate118',
              workflowactions: {
                ONENTRY: {
                  setfieldvalueaction: {
                    workflowaction166: {
                      [SCRIPT_ID]: 'workflowaction166',
                      [SELECT_RECORD_TYPE]: new ReferenceExpression(
                        customRecordType.elemID.createNestedID('attr', SCRIPT_ID),
                        customRecordType.annotations[SCRIPT_ID],
                        customRecordType,
                      ),
                      // should not resolve - there is no suiteql table instnace for custom record types
                      defaultvalue: ACCOUNT_SPECIFIC_VALUE,
                    },
                    workflowaction167: {
                      [SCRIPT_ID]: 'workflowaction167',
                      resultfield: new ReferenceExpression(
                        workflowInstance1.elemID.createNestedID(
                          'workflowcustomfields',
                          'workflowcustomfield',
                          'custworkflow1',
                          SCRIPT_ID,
                        ),
                      ),
                      defaultvalue: '3',
                    },
                  },
                  sendemailaction: {
                    workflowaction224: {
                      [SCRIPT_ID]: 'workflowaction224',
                      field: 'UNKNOWN',
                      // should not resolve - field is UNKNOWN
                      defaultvalue: ACCOUNT_SPECIFIC_VALUE,
                      [INIT_CONDITION]: {
                        formula: '"User Role" IN ("Role1")',
                        parameters: {
                          parameter: {
                            'User_Role@s': {
                              name: 'User Role',
                              value: 'STDUSERROLE',
                            },
                            Role1: {
                              name: 'Role1',
                              [SELECT_RECORD_TYPE]: '-118',
                              value: '[scriptid=customrole123]',
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
      expect(workflowInstance2.value).toEqual({
        [SCRIPT_ID]: 'customworkflow2',
        [NAME_FIELD]: 'Custom workflow 2',
        workflowstates: {
          workflowstate: {
            workflowstate18: {
              [SCRIPT_ID]: 'workflowstate18',
              workflowactions: {
                ONENTRY: {
                  setfieldvalueaction: {
                    workflowaction66: {
                      [SCRIPT_ID]: 'workflowaction66',
                      [INIT_CONDITION]: {
                        formula:
                          '((( "Total" > "0.0" AND "Preferred Language" IN ("Language1","Language2","Language3") AND "Type" IN ("Transaction Type1") AND "Employee" IN ("Employee2") ) OR ( "Type" IN ("Transaction Type1") AND "Preferred Language" IN ("Language2","Language1","Language3") ) AND "Employee" IN ("Employee2") ) AND "Subsidiary (Main)" IN ("{#Subsidiary#}1") )',
                        parameters: {
                          parameter: {
                            'Preferred_Language@s': {
                              name: 'Preferred Language',
                              value: '[scriptid=custbody_rsm_klp_preferred_language]',
                            },
                            Language1: {
                              name: 'Language1',
                              [SELECT_RECORD_TYPE]: '-224',
                              value: '2',
                            },
                            Language2: {
                              name: 'Language2',
                              [SELECT_RECORD_TYPE]: '-224',
                              value: '13',
                            },
                            Language3: {
                              name: 'Language3',
                              [SELECT_RECORD_TYPE]: '-224',
                              value: '60',
                            },
                            Type: {
                              name: 'Type',
                              value: 'STDBODYTRANTYPE',
                            },
                            'Transaction_Type1@s': {
                              name: 'Transaction Type1',
                              [SELECT_RECORD_TYPE]: '-100',
                              value: 'INVOICE',
                            },
                            Employee: {
                              name: 'Employee',
                              value: 'STDBODYEMPLOYEE',
                            },
                            Employee2: {
                              name: 'Employee2',
                              [SELECT_RECORD_TYPE]: '-4',
                              value: '-2',
                            },
                            'Subsidiary__Main_@sjk': {
                              name: 'Subsidiary (Main)',
                              value: 'STDBODYSUBSIDIARY',
                            },
                            '__Subsidiary__1@_00123nn_00125': {
                              name: '{#Subsidiary#}1',
                              [SELECT_RECORD_TYPE]: '-117',
                              value: '38',
                            },
                          },
                        },
                      },
                    },
                  },
                  sendemailaction: {
                    workflowaction124: {
                      [SCRIPT_ID]: 'workflowaction124',
                      field: 'STDBODYACCOUNT',
                      defaultvalue: '5',
                      recipient: '-4',
                      sender: '-3',
                    },
                  },
                },
              },
              workflowstatecustomfields: {
                workflowstatecustomfield: {
                  custwfstate2: {
                    [SCRIPT_ID]: 'custwfstate2',
                    field: new ReferenceExpression(
                      customFieldInstance.elemID.createNestedID(SCRIPT_ID),
                      customFieldInstance.value[SCRIPT_ID],
                      customFieldInstance,
                    ),
                    defaultvalue: '-1',
                  },
                },
              },
            },
          },
        },
      })
    })
  })
})
