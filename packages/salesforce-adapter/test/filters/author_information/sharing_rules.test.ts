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
  CORE_ANNOTATIONS,
  ElemID,
  ObjectType,
  InstanceElement,
} from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { buildFetchProfile } from '../../../src/fetch_profile/fetch_profile'
import { mockFileProperties } from '../../connection'
import mockClient from '../../client'
import Connection from '../../../src/client/jsforce'
import SalesforceClient from '../../../src/client/client'
import { Filter, FilterResult } from '../../../src/filter'
import sharingRules, {
  WARNING_MESSAGE,
} from '../../../src/filters/author_information/sharing_rules'
import { defaultFilterContext } from '../../utils'
import { API_NAME } from '../../../src/constants'

describe('sharing rules author information test', () => {
  let filter: Filter
  let client: SalesforceClient
  let connection: MockInterface<Connection>
  let sharingRulesInstance: InstanceElement
  const firstRule = mockFileProperties({
    fullName: 'Account.rule1',
    type: 'test',
    createdByName: 'firstRuler',
    createdDate: 'created_date',
    lastModifiedByName: 'firstRuler',
    lastModifiedDate: '2021-10-19T06:30:10.000Z',
  })
  const secondRule = mockFileProperties({
    fullName: 'Account.rule2',
    type: 'test',
    createdByName: 'secondRuler',
    createdDate: 'created_date',
    lastModifiedByName: 'secondRuler',
    lastModifiedDate: '2021-10-19T06:41:10.000Z',
  })
  const sharingRulesObjectType = new ObjectType({
    elemID: new ElemID('salesforce', 'SharingRules'),
    annotations: { [API_NAME]: 'SharingRules' },
    fields: {},
  })
  const instanceToIgnore = new InstanceElement('ignore', sharingRulesObjectType)
  instanceToIgnore.value.fullName = 'ignore'
  beforeEach(async () => {
    ;({ connection, client } = mockClient())
    filter = sharingRules({ client, config: defaultFilterContext })
    sharingRulesInstance = new InstanceElement('name', sharingRulesObjectType)
    sharingRulesInstance.value.fullName = 'Account'
  })
  describe('success', () => {
    beforeEach(async () => {
      connection.metadata.list.mockResolvedValueOnce([firstRule, secondRule])
      await filter.onFetch?.([sharingRulesInstance, instanceToIgnore])
    })
    it('should add author annotations to sharing rules', async () => {
      expect(
        sharingRulesInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY],
      ).toEqual('secondRuler')
      expect(
        sharingRulesInstance.annotations[CORE_ANNOTATIONS.CHANGED_AT],
      ).toEqual('2021-10-19T06:41:10.000Z')
    })
    it('should leave rules with no information as they are', async () => {
      expect(
        instanceToIgnore.annotations[CORE_ANNOTATIONS.CHANGED_BY],
      ).not.toBeDefined()
      expect(
        instanceToIgnore.annotations[CORE_ANNOTATIONS.CHANGED_AT],
      ).not.toBeDefined()
    })
  })
  describe('failure', () => {
    it('should return a warning', async () => {
      connection.metadata.list.mockImplementation(() => {
        throw new Error()
      })
      const res = (await filter.onFetch?.([
        sharingRulesInstance,
      ])) as FilterResult
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
      filter = sharingRules({
        client,
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            fetchParams: { optionalFeatures: { authorInformation: false } },
          }),
        },
      })
      await filter.onFetch?.([sharingRulesInstance])
      expect(
        sharingRulesInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY],
      ).not.toBeDefined()
      expect(
        sharingRulesInstance.annotations[CORE_ANNOTATIONS.CHANGED_AT],
      ).not.toBeDefined()
    })
  })
})
