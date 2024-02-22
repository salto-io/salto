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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'
import workflowAccountSpecificValidator from '../../src/change_validators/workflow_account_specific_values'
import { NETSUITE, SCRIPT_ID } from '../../src/constants'
import { INTERNAL_IDS_MAP, SUITEQL_TABLE } from '../../src/data_elements/suiteql_table_elements'

describe('workflow account specific values', () => {
  let instance: InstanceElement
  let suiteqlTableInstance: InstanceElement
  beforeEach(() => {
    instance = new InstanceElement('instance', workflowType().type, {
      isinactive: false,
      [SCRIPT_ID]: 'customworkflow3',
      name: 'WokrflowName',
      initcondition: {
        parameters: {
          parameter: {
            Account1: {
              name: 'Account1',
              value: '[STDUSERUSER]',
            },
            Account2: {
              name: 'Account2',
              value: '[STDUSERUSER]',
            },
          },
        },
      },
      another: {
        parameters: {
          parameter: {
            Account1: {
              name: 'Account1',
              value: '[STDUSERUSER]',
            },
            Account2: {
              name: 'Account2',
              value: '[STDUSERUSER]',
            },
          },
        },
      },
      workflowstates: {
        workflowstate: {
          workflowstate1: {
            workflowactions: {
              sendemailaction: {
                workflowaction: {
                  recipientemail: '[STDUSERUSER]',
                  recipienttype: 'FIELD',
                  sender: '[STDUSERUSER]',
                  sendertype: 'FIELD',
                  initcondition: {
                    parameters: {
                      parameter: {
                        Account1: {
                          name: 'Account1',
                          value: '[STDUSERUSER]',
                        },
                        Account2: {
                          name: 'Account2',
                          value: '[STDUSERUSER]',
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
    const suiteqlTableType = new ObjectType({ elemID: new ElemID(NETSUITE, SUITEQL_TABLE) })
    suiteqlTableInstance = new InstanceElement('employee', suiteqlTableType, {
      [INTERNAL_IDS_MAP]: {
        1: { name: 'Salto user 1' },
        2: { name: 'Salto user 2' },
        3: { name: 'Salto user 3' },
        4: { name: 'Salto user 3' },
      },
    })
  })

  it('should not have changeError when deploying an instance without ACCOUNT_SPECIFIC_VALUES', async () => {
    const after = instance.clone()
    const changeErrors = await workflowAccountSpecificValidator(
      [toChange({ before: instance, after })],
      false,
      buildElementsSourceFromElements([]),
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('should have a generic ASV warning when deploying an instance with ACCOUNT_SPECIFIC_VALUES', async () => {
    const after = instance.clone()
    after.value.valueselect = '[ACCOUNT_SPECIFIC_VALUE]|[ACCOUNT_SPECIFIC_VALUE]'
    const changeErrors = await workflowAccountSpecificValidator(
      [toChange({ before: instance, after })],
      false,
      buildElementsSourceFromElements([]),
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Warning')
    expect(changeErrors[0].elemID).toEqual(instance.elemID)
    expect(changeErrors[0].message).toEqual('Values containing ACCOUNT_SPECIFIC_VALUE are ignored by NetSuite')
  })

  describe('sender and recepient fields', () => {
    it('should have changeError when deploying an instance with sender = ACCOUNT_SPECIFIC_VALUES and sendertype = SPECIFIC', async () => {
      const after = instance.clone()
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.sender =
        '[ACCOUNT_SPECIFIC_VALUE]'
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.sendertype =
        'SPECIFIC'
      const changeErrors = await workflowAccountSpecificValidator(
        [toChange({ before: instance, after })],
        false,
        buildElementsSourceFromElements([]),
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
      expect(changeErrors[0].detailedMessage).toContain(
        "The Workflow contains a 'sender' field with an ACCOUNT_SPECIFIC_VALUE",
      )
    })
    it('should have changeError when deploying an instance with recipient = ACCOUNT_SPECIFIC_VALUES and recipienttype = SPECIFIC', async () => {
      const after = instance.clone()
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.recipient =
        '[ACCOUNT_SPECIFIC_VALUE]'
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.recipienttype =
        'SPECIFIC'
      const changeErrors = await workflowAccountSpecificValidator(
        [toChange({ before: instance, after })],
        false,
        buildElementsSourceFromElements([]),
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
      expect(changeErrors[0].detailedMessage).toContain(
        "The Workflow contains a 'recipient' field with an ACCOUNT_SPECIFIC_VALUE",
      )
    })
    it('should have changeError for both fields', async () => {
      const after = instance.clone()
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.sender =
        '[ACCOUNT_SPECIFIC_VALUE]'
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.sendertype =
        'SPECIFIC'
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.recipient =
        '[ACCOUNT_SPECIFIC_VALUE]'
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.recipienttype =
        'SPECIFIC'
      const changeErrors = await workflowAccountSpecificValidator(
        [toChange({ before: instance, after })],
        false,
        buildElementsSourceFromElements([]),
      )
      expect(changeErrors).toHaveLength(2)
      expect(changeErrors).toEqual(
        expect.arrayContaining([
          {
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Workflow contains fields which cannot be deployed',
            detailedMessage: expect.stringContaining(
              "The Workflow contains a 'recipient' field with an ACCOUNT_SPECIFIC_VALUE",
            ),
          },
          {
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Workflow contains fields which cannot be deployed',
            detailedMessage: expect.stringContaining(
              "The Workflow contains a 'sender' field with an ACCOUNT_SPECIFIC_VALUE",
            ),
          },
        ]),
      )
    })
    it('should not have changeError when sendertype is not SPECIFIC', async () => {
      const after = instance.clone()
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.sender =
        '[ACCOUNT_SPECIFIC_VALUE]'
      const changeErrors = await workflowAccountSpecificValidator(
        [toChange({ before: instance, after })],
        false,
        buildElementsSourceFromElements([]),
      )
      expect(changeErrors).toHaveLength(0)
    })
    it('should not have changeErrors when the account specific values are resolved', async () => {
      const after = instance.clone()
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.sender =
        '[ACCOUNT_SPECIFIC_VALUE] (Salto user 1)'
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.sendertype =
        'SPECIFIC'
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.recipient =
        '[ACCOUNT_SPECIFIC_VALUE] (Salto user 1)'
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.recipienttype =
        'SPECIFIC'
      const changeErrors = await workflowAccountSpecificValidator(
        [toChange({ before: instance, after })],
        false,
        buildElementsSourceFromElements([suiteqlTableInstance]),
      )
      expect(changeErrors).toHaveLength(0)
    })
    it('should have changeErrors when the account specific values cannot be resolved', async () => {
      const after = instance.clone()
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.sender =
        '[ACCOUNT_SPECIFIC_VALUE] (Unknown Salto user)'
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.sendertype =
        'SPECIFIC'
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.recipient =
        '[ACCOUNT_SPECIFIC_VALUE] (Unknown Salto user)'
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.recipienttype =
        'SPECIFIC'
      const changeErrors = await workflowAccountSpecificValidator(
        [toChange({ before: instance, after })],
        false,
        buildElementsSourceFromElements([suiteqlTableInstance]),
      )
      expect(changeErrors).toHaveLength(4)
      expect(changeErrors).toEqual(
        expect.arrayContaining([
          {
            elemID: ElemID.fromFullName(
              'netsuite.workflow.instance.instance.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction',
            ),
            severity: 'Warning',
            message: 'Could not identify value in workflow',
            detailedMessage:
              'Could not find object "Unknown Salto user" for field "recipient". Setting it to ACCOUNT_SPECIFIC_VALUE instead. Learn more at https://help.salto.io/en/articles/8952685-identifying-account-specific-values-in-netsuite',
          },
          {
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Workflow contains fields which cannot be deployed',
            detailedMessage: expect.stringContaining(
              "The Workflow contains a 'recipient' field with an ACCOUNT_SPECIFIC_VALUE",
            ),
          },
          {
            elemID: ElemID.fromFullName(
              'netsuite.workflow.instance.instance.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction',
            ),
            severity: 'Warning',
            message: 'Could not identify value in workflow',
            detailedMessage:
              'Could not find object "Unknown Salto user" for field "sender". Setting it to ACCOUNT_SPECIFIC_VALUE instead. Learn more at https://help.salto.io/en/articles/8952685-identifying-account-specific-values-in-netsuite',
          },
          {
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Workflow contains fields which cannot be deployed',
            detailedMessage: expect.stringContaining(
              "The Workflow contains a 'sender' field with an ACCOUNT_SPECIFIC_VALUE",
            ),
          },
        ]),
      )
    })
  })

  describe('condition parameters warning', () => {
    it('should return warning on a condition with ACCOUNT_SPECIFIC_VALUE parameter', async () => {
      const after = instance.clone()
      after.value.initcondition.parameters.parameter.Account1.value = '[ACCOUNT_SPECIFIC_VALUE]'
      const changeErrors = await workflowAccountSpecificValidator(
        [toChange({ before: instance, after })],
        false,
        buildElementsSourceFromElements([]),
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors).toEqual([
        {
          elemID: instance.elemID.createNestedID('initcondition'),
          severity: 'Warning',
          message: "Workflow Condition won't be deployed",
          detailedMessage:
            'This Workflow Condition includes an ACCOUNT_SPECIFIC_VALUE, which, due to NetSuite limitations, cannot be deployed.' +
            ' To ensure a smooth deployment, please edit the element in Salto and replace ACCOUNT_SPECIFIC_VALUE with the real value.' +
            ' Other non-restricted aspects of the Workflow will be deployed as usual.',
        },
      ])
    })
    it('should return warning on all conditions with ACCOUNT_SPECIFIC_VALUE parameters', async () => {
      const after = instance.clone()
      after.value.initcondition.parameters.parameter.Account1.value = '[ACCOUNT_SPECIFIC_VALUE]'
      after.value.initcondition.parameters.parameter.Account2.value = '[ACCOUNT_SPECIFIC_VALUE]'
      after.value.another.parameters.parameter.Account2.value = '[ACCOUNT_SPECIFIC_VALUE]'
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.initcondition.parameters.parameter.Account2.value =
        '[ACCOUNT_SPECIFIC_VALUE]'
      const changeErrors = await workflowAccountSpecificValidator(
        [toChange({ before: instance, after })],
        false,
        buildElementsSourceFromElements([]),
      )
      expect(changeErrors).toHaveLength(3)
      expect(changeErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ elemID: instance.elemID.createNestedID('initcondition') }),
          expect.objectContaining({ elemID: instance.elemID.createNestedID('another', 'parameters', 'parameter') }),
          expect.objectContaining({
            elemID: instance.elemID.createNestedID(
              'workflowstates',
              'workflowstate',
              'workflowstate1',
              'workflowactions',
              'sendemailaction',
              'workflowaction',
              'initcondition',
            ),
          }),
        ]),
      )
    })
    it('should return warning on an addition change', async () => {
      instance.value.initcondition.parameters.parameter.Account1.value = '[ACCOUNT_SPECIFIC_VALUE]'
      const changeErrors = await workflowAccountSpecificValidator(
        [toChange({ after: instance })],
        false,
        buildElementsSourceFromElements([]),
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors).toEqual([
        {
          elemID: instance.elemID.createNestedID('initcondition'),
          severity: 'Warning',
          message: "Workflow Condition won't be deployed",
          detailedMessage:
            'This Workflow Condition includes an ACCOUNT_SPECIFIC_VALUE, which, due to NetSuite limitations, cannot be deployed.' +
            ' To ensure a smooth deployment, please edit the element in Salto and replace ACCOUNT_SPECIFIC_VALUE with the real value.' +
            ' Other non-restricted aspects of the Workflow will be deployed as usual.',
        },
      ])
    })
    it('should return warning when the condition is changed', async () => {
      instance.value.initcondition.parameters.parameter.Account1.value = '[ACCOUNT_SPECIFIC_VALUE]'
      const after = instance.clone()
      after.value.initcondition.formula = '"Account1" EQUALS "Account2"'
      const changeErrors = await workflowAccountSpecificValidator(
        [toChange({ before: instance, after })],
        false,
        buildElementsSourceFromElements([]),
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors).toEqual([
        {
          elemID: instance.elemID.createNestedID('initcondition'),
          severity: 'Warning',
          message: "Workflow Condition won't be deployed",
          detailedMessage:
            'This Workflow Condition includes an ACCOUNT_SPECIFIC_VALUE, which, due to NetSuite limitations, cannot be deployed.' +
            ' To ensure a smooth deployment, please edit the element in Salto and replace ACCOUNT_SPECIFIC_VALUE with the real value.' +
            ' Other non-restricted aspects of the Workflow will be deployed as usual.',
        },
      ])
    })
    it('should not return warning when the condition is not changed', async () => {
      instance.value.initcondition.parameters.parameter.Account1.value = '[ACCOUNT_SPECIFIC_VALUE]'
      const after = instance.clone()
      after.value.workflowstates.workflowstate.workflowstate1.workflowactions.sendemailaction.workflowaction.initcondition.formula =
        '"Account1" EQUALS "Account2"'
      const changeErrors = await workflowAccountSpecificValidator(
        [toChange({ before: instance, after })],
        false,
        buildElementsSourceFromElements([]),
      )
      expect(changeErrors).toHaveLength(0)
    })
    it('should not return warning when the account specific value is resolved', async () => {
      instance.value.initcondition.parameters.parameter.Account1.value = '[ACCOUNT_SPECIFIC_VALUE] (Salto user 1)'
      instance.value.initcondition.parameters.parameter.Account1.selectrecordtype = '-4'
      const after = instance.clone()
      after.value.initcondition.formula = '"Account1" EQUALS "Account2"'
      const changeErrors = await workflowAccountSpecificValidator(
        [toChange({ before: instance, after })],
        false,
        buildElementsSourceFromElements([suiteqlTableInstance]),
      )
      expect(changeErrors).toHaveLength(0)
    })
    it('should return warnings when the account specific value cannot be resolved', async () => {
      instance.value.initcondition.parameters.parameter.Account1.value = '[ACCOUNT_SPECIFIC_VALUE] (Unknown Salto user)'
      instance.value.initcondition.parameters.parameter.Account1.selectrecordtype = '-4'
      const after = instance.clone()
      after.value.initcondition.formula = '"Account1" EQUALS "Account2"'
      const changeErrors = await workflowAccountSpecificValidator(
        [toChange({ before: instance, after })],
        false,
        buildElementsSourceFromElements([suiteqlTableInstance]),
      )
      expect(changeErrors).toHaveLength(2)
      expect(changeErrors).toEqual(
        expect.arrayContaining([
          {
            elemID: instance.elemID.createNestedID('initcondition', 'parameters', 'parameter', 'Account1'),
            severity: 'Warning',
            message: 'Could not identify value in workflow',
            detailedMessage:
              'Could not find object "Unknown Salto user" for field "value". Setting it to ACCOUNT_SPECIFIC_VALUE instead. Learn more at https://help.salto.io/en/articles/8952685-identifying-account-specific-values-in-netsuite',
          },
          {
            elemID: instance.elemID.createNestedID('initcondition'),
            severity: 'Warning',
            message: "Workflow Condition won't be deployed",
            detailedMessage:
              'This Workflow Condition includes an ACCOUNT_SPECIFIC_VALUE, which, due to NetSuite limitations, cannot be deployed.' +
              ' To ensure a smooth deployment, please edit the element in Salto and replace ACCOUNT_SPECIFIC_VALUE with the real value.' +
              ' Other non-restricted aspects of the Workflow will be deployed as usual.',
          },
        ]),
      )
    })
    it('should return warning when the account specific value name is not unique', async () => {
      instance.value.initcondition.parameters.parameter.Account1.value = '[ACCOUNT_SPECIFIC_VALUE] (Salto user 3)'
      instance.value.initcondition.parameters.parameter.Account1.selectrecordtype = '-4'
      const after = instance.clone()
      after.value.initcondition.formula = '"Account1" EQUALS "Account2"'
      const changeErrors = await workflowAccountSpecificValidator(
        [toChange({ before: instance, after })],
        false,
        buildElementsSourceFromElements([suiteqlTableInstance]),
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors).toEqual(
        expect.arrayContaining([
          {
            elemID: instance.elemID.createNestedID('initcondition', 'parameters', 'parameter', 'Account1'),
            severity: 'Warning',
            message: 'Multiple objects with the same name',
            detailedMessage:
              'There are multiple objects with the name "Salto user 3". Using the first one (internal id: 3). Learn more at https://help.salto.io/en/articles/8952685-identifying-account-specific-values-in-netsuite',
          },
        ]),
      )
    })
  })
})
