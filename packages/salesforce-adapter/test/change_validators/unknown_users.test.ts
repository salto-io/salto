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
  ChangeError,
  ChangeValidator,
  ElemID,
  getChangeData,
  InstanceElement,
  ListType,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import mockAdapter from '../adapter'
import changeValidator from '../../src/change_validators/unknown_users'
import {
  createInstanceElement,
  createMetadataObjectType,
} from '../../src/transformers/transformer'
import {
  CUSTOM_OBJECT,
  CUSTOM_OBJECT_ID_FIELD,
  INSTANCE_FULL_NAME_FIELD,
  METADATA_TYPE,
  SALESFORCE,
} from '../../src/constants'
import { SalesforceRecord } from '../../src/client/types'
import { mockTypes } from '../mock_elements'
import { createCustomObjectType } from '../utils'
import * as filterUtilsModule from '../../src/filters/utils'

jest.mock('../../src/filters/utils', () => ({
  ...jest.requireActual('../../src/filters/utils'),
  queryClient: jest.fn(),
}))

const mockedFilterUtils = jest.mocked(filterUtilsModule)

const setupClientMock = (userNames: string[]): void => {
  const mockQueryResult = userNames.map(
    (userName): SalesforceRecord => ({
      [CUSTOM_OBJECT_ID_FIELD]: 'SomeId',
      Username: userName,
    }),
  )

  mockedFilterUtils.queryClient.mockResolvedValue(mockQueryResult)
}

describe('unknown user change validator', () => {
  const IRRELEVANT_USERNAME = 'SomeUsername'
  const TEST_USERNAME = 'ExistingUsername'
  const ANOTHER_TEST_USERNAME = 'BadUserName'

  let validator: ChangeValidator

  beforeAll(() => {
    validator = changeValidator(mockAdapter({}).client)
  })

  describe('when an irrelevant instance changes', () => {
    const irrelevantType = createCustomObjectType('SomeType', {
      annotations: { metadataType: CUSTOM_OBJECT, apiName: 'SomeType' },
      fields: {
        defaultCaseOwner: {
          refType: BuiltinTypes.STRING,
        },
      },
    })
    let irrelevantChange: Change
    beforeEach(() => {
      const beforeRecord = createInstanceElement(
        { fullName: 'someName', defaultCaseOwner: IRRELEVANT_USERNAME },
        irrelevantType,
      )
      const afterRecord = beforeRecord.clone()
      afterRecord.value.userName = ANOTHER_TEST_USERNAME
      irrelevantChange = toChange({ before: beforeRecord, after: afterRecord })
    })

    it('should pass validation', async () => {
      const changeErrors = await validator([irrelevantChange])
      expect(changeErrors).toBeEmpty()
    })
  })
  describe('when a username exists in Salesforce', () => {
    let change: Change
    beforeEach(() => {
      const beforeRecord = createInstanceElement(
        { fullName: 'someName', defaultCaseUser: IRRELEVANT_USERNAME },
        mockTypes.CaseSettings,
      )
      const afterRecord = beforeRecord.clone()
      afterRecord.value.defaultCaseUser = TEST_USERNAME
      change = toChange({ before: beforeRecord, after: afterRecord })

      setupClientMock([TEST_USERNAME])
    })

    it('should pass validation', async () => {
      const changeErrors = await validator([change])
      expect(changeErrors).toBeEmpty()
    })
  })
  describe('when the username should be retrieved depending on a type field', () => {
    let change: Change
    const instanceElementWithTypeAndUser = (
      type: ObjectType,
      userField: string,
      typeField: string,
    ): InstanceElement =>
      createInstanceElement(
        {
          fullName: 'someFullName',
          [userField]: IRRELEVANT_USERNAME,
          [typeField]: 'User',
        },
        type,
      )

    describe.each([
      {
        type: mockTypes.FolderShare,
        userField: 'sharedTo',
        typeField: 'sharedToType',
      },
      {
        type: mockTypes.WorkflowTask,
        userField: 'assignedTo',
        typeField: 'assignedToType',
      },
      {
        type: mockTypes.CaseSettings,
        userField: 'defaultCaseOwner',
        typeField: 'defaultCaseOwnerType',
      },
    ])(
      'when the username exists [$type.elemID.typeName]',
      ({ type, userField, typeField }) => {
        beforeEach(() => {
          const instanceElement = instanceElementWithTypeAndUser(
            type,
            userField,
            typeField,
          )
          const beforeRecord = instanceElement
          const afterRecord = instanceElement.clone()
          afterRecord.value[userField] = TEST_USERNAME
          change = toChange({ before: beforeRecord, after: afterRecord })

          setupClientMock([TEST_USERNAME])
        })

        it('should pass validation', async () => {
          const changeErrors = await validator([change])
          expect(changeErrors).toBeEmpty()
        })
      },
    )
    describe.each([
      {
        type: mockTypes.FolderShare,
        userField: 'sharedTo',
        typeField: 'sharedToType',
      },
      {
        type: mockTypes.WorkflowTask,
        userField: 'assignedTo',
        typeField: 'assignedToType',
      },
      {
        type: mockTypes.CaseSettings,
        userField: 'defaultCaseOwner',
        typeField: 'defaultCaseOwnerType',
      },
    ])(
      'when the username doesn`t exist but type is not `User` [$type.elemID.typeName]',
      ({ type, userField, typeField }) => {
        beforeEach(() => {
          const instanceElement = instanceElementWithTypeAndUser(
            type,
            userField,
            typeField,
          )
          const beforeRecord = instanceElement
          const afterRecord = instanceElement.clone()
          afterRecord.value[typeField] = 'Role'
          afterRecord.value[userField] = TEST_USERNAME
          change = toChange({ before: beforeRecord, after: afterRecord })

          setupClientMock([])
        })
        it('should also pass validation', async () => {
          const changeErrors = await validator([change])
          expect(changeErrors).toBeEmpty()
        })
      },
    )
    describe.each([
      {
        type: mockTypes.FolderShare,
        userField: 'sharedTo',
        typeField: 'sharedToType',
      },
      {
        type: mockTypes.WorkflowTask,
        userField: 'assignedTo',
        typeField: 'assignedToType',
      },
      {
        type: mockTypes.CaseSettings,
        userField: 'defaultCaseOwner',
        typeField: 'defaultCaseOwnerType',
      },
    ])(
      'when the username doesn`t exist [$type.elemID.typeName]',
      ({ type, userField, typeField }) => {
        beforeEach(() => {
          const instanceElement = instanceElementWithTypeAndUser(
            type,
            userField,
            typeField,
          )
          const beforeRecord = instanceElement
          const afterRecord = instanceElement.clone()
          afterRecord.value[userField] = TEST_USERNAME
          change = toChange({ before: beforeRecord, after: afterRecord })

          setupClientMock([])
        })
        it('should fail validation', async () => {
          const changeErrors = await validator([change])
          expect(changeErrors[0].elemID).toEqual(getChangeData(change).elemID)
        })
      },
    )
  })
  describe('when a username does not exist in Salesforce', () => {
    let change: Change
    beforeEach(() => {
      const beforeRecord = createInstanceElement(
        { fullName: 'someName', defaultCaseUser: IRRELEVANT_USERNAME },
        mockTypes.CaseSettings,
      )
      const afterRecord = beforeRecord.clone()
      afterRecord.value.defaultCaseUser = ANOTHER_TEST_USERNAME
      change = toChange({ before: beforeRecord, after: afterRecord })

      setupClientMock([TEST_USERNAME])
    })

    it('should fail validation', async () => {
      const changeErrors = await validator([change])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].elemID).toEqual(getChangeData(change).elemID)
    })

    it('should pass validation if the defaultCaseOwnerType is not "User"', async () => {
      const instanceAfter = getChangeData(change) as InstanceElement
      instanceAfter.value.defaultCaseOwnerType = 'Other'
      instanceAfter.value.defaultCaseOwner = 'BlahBlah'
      instanceAfter.value.defaultCaseUser = undefined

      const changeErrors = await validator([change])
      expect(changeErrors).toBeEmpty()
    })
  })
  describe('when an instance references multiple usernames', () => {
    let change: Change
    beforeEach(() => {
      const beforeRecord = createInstanceElement(
        {
          fullName: 'someName',
          defaultCaseUser: IRRELEVANT_USERNAME,
          defaultCaseOwnerType: 'User',
          defaultCaseOwner: TEST_USERNAME,
        },
        mockTypes.CaseSettings,
      )
      const afterRecord = beforeRecord.clone()
      afterRecord.value.defaultCaseUser = ANOTHER_TEST_USERNAME
      change = toChange({ before: beforeRecord, after: afterRecord })
    })

    it('should pass validation if both usernames exist in Salesforce', async () => {
      setupClientMock([TEST_USERNAME, ANOTHER_TEST_USERNAME])
      const changeErrors = await validator([change])
      expect(changeErrors).toBeEmpty()
    })

    it('should fail validation if only one of the usernames exists in Salesforce', async () => {
      setupClientMock([TEST_USERNAME])
      const changeErrors = await validator([change])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].elemID).toEqual(getChangeData(change).elemID)
    })
    it('should fail validation twice if neither username exists in Salesforce', async () => {
      setupClientMock([])
      const changeErrors = await validator([change])
      expect(changeErrors).toHaveLength(2)
      expect(changeErrors[0].elemID).toEqual(getChangeData(change).elemID)
      expect(changeErrors[0].detailedMessage).toContain(ANOTHER_TEST_USERNAME)
      expect(changeErrors[1].elemID).toEqual(getChangeData(change).elemID)
      expect(changeErrors[1].detailedMessage).toContain(TEST_USERNAME)
    })
  })
  describe('when a field references multiple usernames', () => {
    let change: Change
    beforeEach(() => {
      const beforeRecord = createInstanceElement(
        {
          fullName: new ElemID(
            SALESFORCE,
            'WorkflowAlert',
            'instance',
            'SomeWorkflowAlert',
          ).getFullName(),
          recipients: [
            {
              type: 'user',
              recipient: TEST_USERNAME,
            },
            {
              type: 'user',
              recipient: ANOTHER_TEST_USERNAME,
            },
            {
              type: 'email',
              recipient: IRRELEVANT_USERNAME,
            },
          ],
        },
        mockTypes.WorkflowAlert,
      )
      const afterRecord = beforeRecord.clone()
      afterRecord.value.defaultCaseUser = ANOTHER_TEST_USERNAME
      change = toChange({ before: beforeRecord, after: afterRecord })
    })

    it("Should only create an error for the users that don't exist", async () => {
      setupClientMock([TEST_USERNAME])
      const changeErrors = await validator([change])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].elemID).toEqual(getChangeData(change).elemID)
      expect(changeErrors[0].detailedMessage).toContain(ANOTHER_TEST_USERNAME)
    })
  })
  describe('WorkflowAlert', () => {
    let changeErrors: readonly ChangeError[]
    describe('when the recipients field has no value', () => {
      beforeEach(async () => {
        const instance = createInstanceElement(
          { [INSTANCE_FULL_NAME_FIELD]: 'TestWorkflowAlert' },
          mockTypes.WorkflowAlert,
        )
        changeErrors = await validator([toChange({ after: instance })])
      })
      it('should not create errors', () => {
        expect(changeErrors).toBeEmpty()
      })
    })
  })
  describe('when the user information is in a nested field', () => {
    const approverType = createMetadataObjectType({
      fields: {
        name: {
          refType: BuiltinTypes.STRING,
        },
        type: {
          refType: BuiltinTypes.STRING,
        },
      },
      annotations: {
        [METADATA_TYPE]: 'Approver',
      },
    })
    const approvalStepApproverType = createMetadataObjectType({
      fields: {
        approver: {
          refType: approverType,
        },
      },
      annotations: {
        [METADATA_TYPE]: 'ApprovalStepApprover',
      },
    })
    const approvalStepType = createMetadataObjectType({
      fields: {
        assignedApprover: {
          refType: approvalStepApproverType,
        },
      },
      annotations: {
        [METADATA_TYPE]: 'ApprovalStep',
      },
    })
    const approvalProcessType = createMetadataObjectType({
      fields: {
        approvalStep: {
          refType: new ListType(approvalStepType),
        },
      },
      annotations: {
        [METADATA_TYPE]: 'ApprovalProcess',
      },
    })
    let changeErrors: readonly ChangeError[]
    beforeEach(async () => {
      const newRecord = createInstanceElement(
        {
          [INSTANCE_FULL_NAME_FIELD]: 'SomeApprovalProcess',
          approvalStep: [
            {
              assignedApprover: {
                approver: {
                  name: TEST_USERNAME,
                  type: 'User',
                },
              },
            },

            {
              assignedApprover: {
                approver: {
                  name: ANOTHER_TEST_USERNAME,
                  type: 'User',
                },
              },
            },
          ],
        },
        approvalProcessType,
      )
      const change = toChange({ after: newRecord })
      setupClientMock([IRRELEVANT_USERNAME])
      changeErrors = await validator([change])
    })
    it('should fail if the users don`t exist', () => {
      expect(changeErrors).toHaveLength(2)
      const instanceElemId = new ElemID(
        SALESFORCE,
        'ApprovalProcess',
        'instance',
        'SomeApprovalProcess',
      )
      expect(changeErrors[0]).toHaveProperty(
        'elemID',
        instanceElemId.createNestedID(
          'approvalStep',
          '0',
          'assignedApprover',
          'approver',
        ),
      )
      expect(changeErrors[1]).toHaveProperty(
        'elemID',
        instanceElemId.createNestedID(
          'approvalStep',
          '1',
          'assignedApprover',
          'approver',
        ),
      )
    })
  })
  describe('when the user information is in a nested array', () => {
    const ruleEntryType = createMetadataObjectType({
      fields: {
        assignedTo: {
          refType: BuiltinTypes.STRING,
        },
        assignedToType: {
          refType: BuiltinTypes.STRING,
        },
      },
      annotations: {
        [METADATA_TYPE]: 'RuleEntry',
      },
    })
    const assignmentRuleType = createMetadataObjectType({
      fields: {
        ruleEntry: {
          refType: new ListType(ruleEntryType),
        },
      },
      annotations: {
        [METADATA_TYPE]: 'AssignmentRule',
      },
    })
    const assignmentRulesType = createMetadataObjectType({
      fields: {
        assignmentRule: {
          refType: new ListType(assignmentRuleType),
        },
      },
      annotations: {
        [METADATA_TYPE]: 'AssignmentRules',
      },
    })
    let changeErrors: readonly ChangeError[]
    beforeEach(async () => {
      const newRecord = createInstanceElement(
        {
          fullName: 'SomeAssignmentRules',
          assignmentRule: [
            {
              ruleEntry: [
                {
                  assignedTo: TEST_USERNAME,
                  assignedToType: 'User',
                },
              ],
            },
            {
              ruleEntry: [
                {
                  assignedTo: ANOTHER_TEST_USERNAME,
                  assignedToType: 'User',
                },
              ],
            },
          ],
        },
        assignmentRulesType,
      )
      const change = toChange({ after: newRecord })
      setupClientMock([IRRELEVANT_USERNAME])
      changeErrors = await validator([change])
    })
    it('should fail if any of the users don`t exist', () => {
      expect(changeErrors).toHaveLength(2)
      const instanceElemId = new ElemID(
        SALESFORCE,
        'AssignmentRules',
        'instance',
        'SomeAssignmentRules',
      )
      expect(changeErrors[0]).toHaveProperty(
        'elemID',
        instanceElemId.createNestedID('assignmentRule', '0', 'ruleEntry', '0'),
      )
      expect(changeErrors[1]).toHaveProperty(
        'elemID',
        instanceElemId.createNestedID('assignmentRule', '1', 'ruleEntry', '0'),
      )
    })
  })
})
