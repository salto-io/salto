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
import { CORE_ANNOTATIONS, ElemID, ObjectType, InstanceElement } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { buildFetchProfile } from '../../../src/fetch_profile/fetch_profile'
import { mockFileProperties } from '../../connection'
import mockClient from '../../client'
import Connection from '../../../src/client/jsforce'
import SalesforceClient from '../../../src/client/client'
import { Filter, FilterResult } from '../../../src/filter'
import validationRules, { WARNING_MESSAGE } from '../../../src/filters/author_information/validation_rules'
import { defaultFilterContext } from '../../utils'
import { API_NAME } from '../../../src/constants'

describe('validation rules author information test', () => {
  let filter: Filter
  let client: SalesforceClient
  let connection: MockInterface<Connection>
  let validationRuleInstance: InstanceElement
  const mockedFileProperties = mockFileProperties({ fullName: 'Account.rule1',
    type: 'test',
    createdByName: 'Ruler',
    createdDate: 'created_date',
    lastModifiedByName: 'Ruler',
    lastModifiedDate: '2021-10-19T06:30:10.000Z' })
  const validationRulesObjectType = new ObjectType({
    elemID: new ElemID('salesforce', 'ValidationRule'),
    annotations: { [API_NAME]: 'ValidationRule' },
    fields: {},
  })
  const instanceToIgnore = new InstanceElement('ignore', validationRulesObjectType)
  instanceToIgnore.value.fullName = 'ignore'
  beforeEach(async () => {
    ({ connection, client } = mockClient())
    filter = validationRules({ client, config: defaultFilterContext })
    validationRuleInstance = new InstanceElement('name', validationRulesObjectType)
    validationRuleInstance.value.fullName = 'Account.rule1'
  })
  describe('success', () => {
    beforeEach(async () => {
      connection.metadata.list.mockResolvedValueOnce([mockedFileProperties])
      await filter.onFetch?.([validationRuleInstance, instanceToIgnore])
    })
    it('should add author annotations to validation rules', async () => {
      expect(validationRuleInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toEqual('Ruler')
      expect(validationRuleInstance.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toEqual('2021-10-19T06:30:10.000Z')
    })
    it('should leave rules with no information as they are', async () => {
      expect(instanceToIgnore.annotations[CORE_ANNOTATIONS.CHANGED_BY]).not.toBeDefined()
      expect(instanceToIgnore.annotations[CORE_ANNOTATIONS.CHANGED_AT]).not.toBeDefined()
    })
  })
  describe('failure', () => {
    it('should return a warning', async () => {
      connection.metadata.list.mockImplementation(() => {
        throw new Error()
      })
      const res = await filter.onFetch?.([validationRuleInstance]) as FilterResult
      const err = res.errors ?? []
      expect(res.errors).toHaveLength(1)
      expect(err[0]).toEqual({
        severity: 'Warning',
        message: WARNING_MESSAGE,
      })
    })
  })
  describe('when feature is disabled', () => {
    it('should not add any annotations', async () => {
      filter = validationRules({
        client,
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            fetchParams: { optionalFeatures: { authorInformation: false } },
            isFetchWithChangesDetection: false,
          }),
        },
      })
      await filter.onFetch?.([validationRuleInstance])
      expect(validationRuleInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY]).not.toBeDefined()
      expect(validationRuleInstance.annotations[CORE_ANNOTATIONS.CHANGED_AT]).not.toBeDefined()
    })
  })
})
