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
import { fetch as fetchUtils, definitions as def, filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import {
  ADAPTER_NAME,
  ESCALATION_POLICY_TYPE_NAME,
  SCHEDULE_LAYERS_TYPE_NAME,
  USER_TYPE_NAME,
} from '../../src/constants'
import { Options } from '../../src/definitions/types'
import { DEFAULT_CONFIG, UserConfig } from '../../src/config'
import usersFilter from '../../src/filters/users'

jest.mock('@salto-io/adapter-components', () => ({
  ...jest.requireActual('@salto-io/adapter-components'),
  fetch: {
    ...jest.requireActual('@salto-io/adapter-components').fetch,
    getElements: jest.fn(),
  },
}))

const mockedGetElements = jest.mocked(fetchUtils).getElements

describe('users filter', () => {
  const scheduleLayerType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SCHEDULE_LAYERS_TYPE_NAME) })
  const escalationPolicyType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, ESCALATION_POLICY_TYPE_NAME) })
  const userType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, USER_TYPE_NAME) })

  const generateElements = (withIds: boolean): InstanceElement[] => {
    const id1 = withIds ? '11111' : 'uri1@salto.io'
    const id2 = withIds ? '22222' : 'uri2@salto.io'
    const id3 = withIds ? '33333' : 'uri3@salto.io'
    const id4 = withIds ? '44444' : 'uri4@salto.io'
    const layerInstance = new InstanceElement('layer', scheduleLayerType, {
      users: [{ user: { id: id1, type: 'user_reference' } }, { user: { id: id2, type: 'user_reference' } }],
    })
    const escalationInstance = new InstanceElement('escalation', escalationPolicyType, {
      escalation_rules: [
        {
          targets: [
            { id: id2, type: 'user_reference' },
            { id: id3, type: 'user_reference' },
          ],
        },
        {
          targets: [
            { id: id4, type: 'user_reference' },
            { id: id1, type: 'team_reference' },
          ],
        },
      ],
    })
    return [layerInstance, escalationInstance]
  }
  let filter: filterUtils.Filter<filterUtils.FilterResult>
  beforeEach(() => {
    filter = usersFilter({
      elementSource: buildElementsSourceFromElements([]),
      fetchQuery: fetchUtils.query.createMockQuery(),
      config: { ...DEFAULT_CONFIG, fetch: { convertUsersIds: true } } as UserConfig,
      definitions: {} as def.ApiDefinitions<Options>,
      sharedContext: {},
    })

    mockedGetElements.mockResolvedValue({
      elements: [
        new InstanceElement('user', userType, { id: '11111', email: 'uri1@salto.io' }),
        new InstanceElement('user', userType, { id: '22222', email: 'uri2@salto.io' }),
        new InstanceElement('user', userType, { id: '33333', email: 'uri3@salto.io' }),
        new InstanceElement('user', userType, { id: '44444', email: 'uri4@salto.io' }),
      ],
    })
  })
  describe('onFetch', () => {
    it('should convert user ids into emails', async () => {
      const elements = generateElements(true)
      await filter.onFetch?.(elements)
      expect(elements[0].value.users[0].user.id).toEqual('uri1@salto.io')
      expect(elements[0].value.users[1].user.id).toEqual('uri2@salto.io')
      expect(elements[1].value.escalation_rules[0].targets[0].id).toEqual('uri2@salto.io')
      expect(elements[1].value.escalation_rules[0].targets[1].id).toEqual('uri3@salto.io')
      expect(elements[1].value.escalation_rules[1].targets[0].id).toEqual('uri4@salto.io')
      expect(elements[1].value.escalation_rules[1].targets[1].id).toEqual('11111')
    })
  })
  describe('preDeploy', () => {
    it('should convert emails into user ids', async () => {
      const elements = generateElements(false)
      await filter.preDeploy?.(elements.map(e => toChange({ after: e })))
      expect(elements[0].value.users[0].user.id).toEqual('11111')
      expect(elements[0].value.users[1].user.id).toEqual('22222')
      expect(elements[1].value.escalation_rules[0].targets[0].id).toEqual('22222')
      expect(elements[1].value.escalation_rules[0].targets[1].id).toEqual('33333')
      expect(elements[1].value.escalation_rules[1].targets[0].id).toEqual('44444')
    })
  })
  describe('onDeploy', () => {
    it('should convert user ids into emails', async () => {
      const elements = generateElements(true)
      await filter.preDeploy?.(elements.map(e => toChange({ after: e })))
      await filter.onDeploy?.(elements.map(e => toChange({ after: e })))
      expect(elements[0].value.users[0].user.id).toEqual('uri1@salto.io')
      expect(elements[0].value.users[1].user.id).toEqual('uri2@salto.io')
      expect(elements[1].value.escalation_rules[0].targets[0].id).toEqual('uri2@salto.io')
      expect(elements[1].value.escalation_rules[0].targets[1].id).toEqual('uri3@salto.io')
      expect(elements[1].value.escalation_rules[1].targets[0].id).toEqual('uri4@salto.io')
      expect(elements[1].value.escalation_rules[1].targets[1].id).toEqual('11111')
    })
  })
})
