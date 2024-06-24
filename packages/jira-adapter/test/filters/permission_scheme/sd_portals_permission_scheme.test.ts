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
import { ElemID, InstanceElement, ObjectType, toChange, getChangeData } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getFilterParams, mockClient } from '../../utils'
import permissionSchemeFilter from '../../../src/filters/permission_scheme/sd_portals_permission_scheme'
import { Filter } from '../../../src/filter'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { JIRA, PERMISSION_SCHEME_TYPE_NAME } from '../../../src/constants'
import JiraClient from '../../../src/client/client'
import { UNSUPPORTED_PERMISSION_SCHEME } from '../../../src/change_validators/sd_portals_permission_scheme'

const PERMISSION_SCHEME = {
  holder: {
    type: 'holderType',
  },
  permission: 'permission',
}

describe('permissionSchemeFilter', () => {
  let filter: Filter
  let type: ObjectType
  let instance: InstanceElement
  let config: JiraConfig
  let client: JiraClient

  beforeEach(async () => {
    const { client: cli, paginator } = mockClient()
    client = cli

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    filter = permissionSchemeFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    )

    type = new ObjectType({
      elemID: new ElemID(JIRA, PERMISSION_SCHEME_TYPE_NAME),
    })
    instance = new InstanceElement('instance', type, {
      permissions: [PERMISSION_SCHEME],
    })
  })
  describe('preDeploy and onDeploy', () => {
    it('should not remove or add any permission scheme', () => {
      const changes = [toChange({ after: instance })]
      expect(getChangeData(changes[0]).value.permissions.length).toEqual(1)
      filter.preDeploy?.(changes)
      expect(changes.length).toEqual(1)
      expect(getChangeData(changes[0]).value.permissions.length).toEqual(1)
      expect(getChangeData(changes[0]).value.permissions[0]).toEqual(PERMISSION_SCHEME)
      filter.onDeploy?.(changes)
      expect(changes.length).toEqual(1)
      expect(getChangeData(changes[0]).value.permissions.length).toEqual(1)
      expect(getChangeData(changes[0]).value.permissions[0]).toEqual(PERMISSION_SCHEME)
    })

    it('should remove the problematic permission scheme in the preDeploy and add it back in the onDeploy', () => {
      instance.value.permissions.push(UNSUPPORTED_PERMISSION_SCHEME)
      const changes = [toChange({ after: instance })]
      expect(getChangeData(changes[0]).value.permissions.length).toEqual(2)
      filter.preDeploy?.(changes)
      expect(changes.length).toEqual(1)
      expect(getChangeData(changes[0]).value.permissions.length).toEqual(1)
      expect(getChangeData(changes[0]).value.permissions[0]).toEqual(PERMISSION_SCHEME)
      filter.onDeploy?.(changes)
      expect(changes.length).toEqual(1)
      expect(getChangeData(changes[0]).value.permissions.length).toEqual(2)
      expect(getChangeData(changes[0]).value.permissions[0]).toEqual(PERMISSION_SCHEME)
      expect(getChangeData(changes[0]).value.permissions[1]).toEqual(UNSUPPORTED_PERMISSION_SCHEME)
    })
  })
})
