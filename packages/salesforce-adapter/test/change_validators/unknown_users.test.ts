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
import {
  BuiltinTypes,
  Change,
  ChangeValidator,
  ElemID,
  getChangeData,
  InstanceElement,
  toChange,
} from '@salto-io/adapter-api'
import mockAdapter from '../adapter'
import changeValidator from '../../src/change_validators/unknown_users'
import { createInstanceElement } from '../../src/transformers/transformer'
import { CUSTOM_OBJECT, CUSTOM_OBJECT_ID_FIELD, SALESFORCE } from '../../src/constants'
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
  const mockQueryResult = userNames.map((userName): SalesforceRecord => ({
    [CUSTOM_OBJECT_ID_FIELD]: 'SomeId',
    Username: userName,
  }))

  mockedFilterUtils.queryClient.mockResolvedValue(mockQueryResult)
}

describe('unknown user change validator', () => {
  const IRRELEVANT_USERNAME = 'SomeUsername'
  const TEST_USERNAME = 'ExistingUsername'
  const ANOTHER_TEST_USERNAME = 'BadUserName'

  let validator:ChangeValidator

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
      const beforeRecord = createInstanceElement({ fullName: 'someName', defaultCaseOwner: IRRELEVANT_USERNAME }, irrelevantType)
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
      const beforeRecord = createInstanceElement({ fullName: 'someName', defaultCaseUser: IRRELEVANT_USERNAME }, mockTypes.CaseSettings)
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
  describe('when the username is in a FolderShare instance', () => {
    let change: Change

    describe('when the username exists', () => {
      beforeEach(() => {
        const beforeRecord = createInstanceElement({
          fullName: 'someName',
          sharedTo: IRRELEVANT_USERNAME,
          sharedToType: 'User',
        }, mockTypes.FolderShare)
        const afterRecord = beforeRecord.clone()
        afterRecord.value.sharedTo = TEST_USERNAME
        change = toChange({ before: beforeRecord, after: afterRecord })

        setupClientMock([TEST_USERNAME])
      })

      it('should pass validation', async () => {
        const changeErrors = await validator([change])
        expect(changeErrors).toBeEmpty()
      })
    })
    describe('when the username doesn\'t exist but sharedToType is not \'User\'', () => {
      beforeEach(() => {
        const beforeRecord = createInstanceElement({
          fullName: 'someName',
          sharedTo: IRRELEVANT_USERNAME,
          sharedToType: 'Role',
        }, mockTypes.FolderShare)
        const afterRecord = beforeRecord.clone()
        afterRecord.value.sharedTo = TEST_USERNAME
        change = toChange({ before: beforeRecord, after: afterRecord })

        setupClientMock([])
      })
      it('should pass validation', async () => {
        const changeErrors = await validator([change])
        expect(changeErrors).toBeEmpty()
      })
    })
  })
  describe('when a username does not exist in Salesforce', () => {
    let change: Change
    beforeEach(() => {
      const beforeRecord = createInstanceElement({ fullName: 'someName', defaultCaseUser: IRRELEVANT_USERNAME }, mockTypes.CaseSettings)
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
      const beforeRecord = createInstanceElement({
        fullName: 'someName',
        defaultCaseUser: IRRELEVANT_USERNAME,
        defaultCaseOwnerType: 'User',
        defaultCaseOwner: TEST_USERNAME,
      },
      mockTypes.CaseSettings)
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
      const beforeRecord = createInstanceElement({
        fullName: new ElemID(SALESFORCE, 'WorkflowAlert', 'instance', 'SomeWorkflowAlert').getFullName(),
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
      mockTypes.WorkflowAlert)
      const afterRecord = beforeRecord.clone()
      afterRecord.value.defaultCaseUser = ANOTHER_TEST_USERNAME
      change = toChange({ before: beforeRecord, after: afterRecord })
    })

    it('Should only create an error for the users that don\'t exist', async () => {
      setupClientMock([TEST_USERNAME])
      const changeErrors = await validator([change])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].elemID).toEqual(getChangeData(change).elemID)
      expect(changeErrors[0].detailedMessage).toContain(ANOTHER_TEST_USERNAME)
    })
  })
})
