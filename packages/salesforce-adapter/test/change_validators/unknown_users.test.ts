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
import { BuiltinTypes, Change, ChangeValidator, ElemID, getChangeData, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import mockAdapter from '../adapter'
import changeValidator from '../../src/change_validators/unknown_users'
import { createInstanceElement } from '../../src/transformers/transformer'
import { CUSTOM_OBJECT, CUSTOM_OBJECT_ID_FIELD } from '../../src/constants'
import SalesforceClient from '../../src/client/client'
import { SalesforceRecord } from '../../src/client/types'

const setupClientMock = (client: SalesforceClient, userNames: string[]): void => {
  const mockQueryResult = userNames.map((userName): SalesforceRecord => ({
    [CUSTOM_OBJECT_ID_FIELD]: 'SomeId',
    Username: userName,
  }))

  client.queryAll = async (_queryString: string): Promise<AsyncIterable<SalesforceRecord[]>> => (
    Promise.resolve({
      [Symbol.asyncIterator]: (): AsyncIterator<SalesforceRecord[]> => {
        let callCnt = 0
        return {
          next: () => {
            if (callCnt < 1) {
              callCnt += 1
              return Promise.resolve({ done: false, value: mockQueryResult })
            }
            return Promise.resolve({ done: true, value: undefined })
          },
        }
      },
    })
  )
}

describe('unknown user change validator', () => {
  const caseSettingsType = new ObjectType({
    elemID: new ElemID('salesforce', 'CaseSettings'),
    annotations: { metadataType: CUSTOM_OBJECT, apiName: 'CaseSettings' },
    fields: {
      defaultCaseOwner: {
        refType: BuiltinTypes.STRING,
      },
      defaultCaseUser: {
        refType: BuiltinTypes.STRING,
      },
      defaultCaseOwnerType: {
        refType: BuiltinTypes.STRING,
      },
    },
  })
  describe('when an irrelevant instance changes', () => {
    const irrelevantType = new ObjectType({
      elemID: new ElemID('salesforce', 'SomeType'),
      annotations: { metadataType: CUSTOM_OBJECT, apiName: 'SomeType' },
      fields: {
        defaultCaseOwner: {
          refType: BuiltinTypes.STRING,
        },
      },
    })
    let irrelevantChange: Change
    let validator: ChangeValidator
    beforeEach(() => {
      validator = changeValidator(mockAdapter({}).client)
      const beforeRecord = createInstanceElement({ fullName: 'someName', defaultCaseOwner: 'someUsername' }, irrelevantType)
      const afterRecord = beforeRecord.clone()
      afterRecord.value.userName = 'someOtherUsername'
      irrelevantChange = toChange({ before: beforeRecord, after: afterRecord })
    })

    it('should pass validation', async () => {
      const changeErrors = await validator([irrelevantChange])
      expect(changeErrors).toBeEmpty()
    })
  })
  describe('when a username exists in Salesforce', () => {
    let change: Change
    let validator: ChangeValidator
    beforeEach(() => {
      const { client } = mockAdapter({})
      validator = changeValidator(client)
      const beforeRecord = createInstanceElement({ fullName: 'someName', defaultCaseUser: 'someUsername' }, caseSettingsType)
      const afterRecord = beforeRecord.clone()
      afterRecord.value.defaultCaseUser = 'someOtherUsername'
      change = toChange({ before: beforeRecord, after: afterRecord })

      setupClientMock(client, ['someOtherUsername'])
    })

    it('should pass validation', async () => {
      const changeErrors = await validator([change])
      expect(changeErrors).toBeEmpty()
    })
  })
  describe('when a username does not exist in Salesforce', () => {
    let change: Change
    let validator: ChangeValidator
    beforeEach(() => {
      const { client } = mockAdapter({})
      validator = changeValidator(client)
      const beforeRecord = createInstanceElement({ fullName: 'someName', defaultCaseUser: 'someUsername' }, caseSettingsType)
      const afterRecord = beforeRecord.clone()
      afterRecord.value.defaultCaseUser = 'someOtherUsername'
      change = toChange({ before: beforeRecord, after: afterRecord })

      setupClientMock(client, ['someUsername'])
    })

    it('should fail validation', async () => {
      const changeErrors = await validator([change])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].detailedMessage).toContain('defaultCaseUser')
      expect(changeErrors[0].detailedMessage).toContain('someOtherUsername')
      expect(changeErrors[0].detailedMessage).toContain('someName')
      expect(changeErrors[0].message).toContain('doesn\'t exist')
      expect(changeErrors[0].message).toContain('someOtherUsername')
    })

    it('should pass validation if the defaultCaseOwnerType is not "User"', async () => {
      (getChangeData(change) as InstanceElement).value.defaultCaseOwnerType = 'Other';
      (getChangeData(change) as InstanceElement).value.defaultCaseOwner = 'BlahBlah';
      (getChangeData(change) as InstanceElement).value.defaultCaseUser = undefined
      const changeErrors = await validator([change])
      expect(changeErrors).toBeEmpty()
    })
  })
  describe('when an instance references multiple usernames', () => {
    let client: SalesforceClient
    let change: Change
    let validator: ChangeValidator
    beforeEach(() => {
      client = mockAdapter({}).client
      validator = changeValidator(client)
      const beforeRecord = createInstanceElement({
        fullName: 'someName',
        defaultCaseUser: 'someUsername',
        defaultCaseOwnerType: 'User',
        defaultCaseOwner: 'someUsername',
      },
      caseSettingsType)
      const afterRecord = beforeRecord.clone()
      afterRecord.value.defaultCaseUser = 'someOtherUsername'
      change = toChange({ before: beforeRecord, after: afterRecord })
    })

    it('should pass validation if both usernames exist in Salesforce', async () => {
      setupClientMock(client, ['someUsername', 'someOtherUsername'])
      const changeErrors = await validator([change])
      expect(changeErrors).toBeEmpty()
    })

    it('should fail validation if only one of the usernames exists in Salesforce', async () => {
      setupClientMock(client, ['someUsername'])
      const changeErrors = await validator([change])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].detailedMessage).toContain('defaultCaseUser')
      expect(changeErrors[0].detailedMessage).toContain('someOtherUsername')
      expect(changeErrors[0].detailedMessage).toContain('someName')
      expect(changeErrors[0].message).toContain('doesn\'t exist')
      expect(changeErrors[0].message).toContain('someOtherUsername')
    })
    it('should fail validation twice if neither username exists in Salesforce', async () => {
      setupClientMock(client, [])
      const changeErrors = await validator([change])
      expect(changeErrors).toHaveLength(2)
      expect(changeErrors[0].detailedMessage).toContain('defaultCaseUser')
      expect(changeErrors[0].detailedMessage).toContain('someOtherUsername')
      expect(changeErrors[0].detailedMessage).toContain('someName')
      expect(changeErrors[0].message).toContain('doesn\'t exist')
      expect(changeErrors[0].message).toContain('someOtherUsername')
      expect(changeErrors[1].detailedMessage).toContain('defaultCaseOwner')
      expect(changeErrors[1].detailedMessage).toContain('someUsername')
      expect(changeErrors[1].detailedMessage).toContain('someName')
      expect(changeErrors[0].message).toContain('doesn\'t exist')
      expect(changeErrors[0].message).toContain('someOtherUsername')
    })
  })
})
