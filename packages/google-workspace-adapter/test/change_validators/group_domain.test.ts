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

import _ from 'lodash'
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { elementSource } from '@salto-io/workspace'
import { ADAPTER_NAME, GROUP_TYPE_NAME, DOMAIN_TYPE_NAME } from '../../src/constants'
import { groupDomainValidator } from '../../src/change_validators'
import { DEFAULT_CONFIG, UserConfig } from '../../src/config'

describe('groupDomainValidator', () => {
  const config: UserConfig = DEFAULT_CONFIG
  const groupType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, GROUP_TYPE_NAME) })
  const domainType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, DOMAIN_TYPE_NAME) })
  const group = new InstanceElement('testGroup1', groupType, {
    email: 'testGroup1@legit.com',
    name: 'testGroup1',
  })
  const primaryDomain = new InstanceElement('primaryDomain', domainType, {
    domainName: 'legit.com',
    isPrimary: true,
  })
  describe('domain are excluded from the fetch', () => {
    beforeEach(() => {
      _.set(config, 'fetch.exclude', [{ type: DOMAIN_TYPE_NAME }])
    })
    it('should return a warning if the domain is not fetched', async () => {
      const errors = await groupDomainValidator(config)(
        [toChange({ after: group })],
        elementSource.createInMemoryElementSource([group]),
      )
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toEqual('Domains are excluded from the fetch, so the group domain cannot be validated.')
    })
  })
  describe('domain are included in the fetch', () => {
    beforeEach(() => {
      _.set(config, 'fetch.exclude', [])
    })
    it('should return an error if the domain does not exist', async () => {
      const errors = await groupDomainValidator(config)(
        [toChange({ after: group })],
        elementSource.createInMemoryElementSource([group]),
      )
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toEqual('Group domain does not exist in the environment.')
    })
    it('should not return an error if the domain exists', async () => {
      const errors = await groupDomainValidator(config)(
        [toChange({ after: group }), toChange({ after: primaryDomain })],
        elementSource.createInMemoryElementSource([group, primaryDomain]),
      )
      expect(errors).toHaveLength(0)
    })
  })
})
