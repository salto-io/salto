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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import {
  ADAPTER_NAME,
  ESCALATION_POLICY_TYPE_NAME,
  SCHEDULE_LAYERS_TYPE_NAME,
  SCHEDULE_TYPE_NAME,
  TEAM_TYPE_NAME,
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
  let filter: filterUtils.Filter<filterUtils.FilterResult>
  const scheduleLayerType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SCHEDULE_LAYERS_TYPE_NAME) })
  const escalationPolicyType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, ESCALATION_POLICY_TYPE_NAME) })
  const scheduleType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SCHEDULE_TYPE_NAME) })
  const userType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, USER_TYPE_NAME) })
  const teamType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, TEAM_TYPE_NAME) })

  const teamInstance = new InstanceElement('team', teamType, { id: 'P123457' })

  const generateElements = (withIds: boolean): InstanceElement[] => {
    const id1 = withIds ? '11111' : 'uri1@salto.io'
    const id2 = withIds ? '22222' : 'uri2@salto.io'
    const id3 = withIds ? '33333' : 'uri3@salto.io'
    const id4 = withIds ? '44444' : 'uri4@salto.io'
    const layerInstance = new InstanceElement('layer', scheduleLayerType, {
      users: [{ user: { id: id1, type: 'user_reference' } }, { user: { id: id2, type: 'user_reference' } }],
    })
    const layerInstance2 = new InstanceElement('layer', scheduleLayerType, {
      users: [{ user: { id: id3, type: 'user_reference' } }],
    })
    const scheduleInstance = new InstanceElement('schedule', scheduleType, {
      timezone: 'uri',
      id: 'uri',
      schedule_layers: [new ReferenceExpression(layerInstance2.elemID, layerInstance2)],
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
    return [layerInstance, escalationInstance, scheduleInstance]
  }
  beforeEach(async () => {
    jest.clearAllMocks()
  })

  describe('when convertUsersIds is off', () => {
    beforeEach(() => {
      filter = usersFilter({
        elementSource: buildElementsSourceFromElements([]),
        fetchQuery: fetchUtils.query.createMockQuery(),
        config: DEFAULT_CONFIG as UserConfig,
        definitions: {} as def.ApiDefinitions<Options>,
        sharedContext: {},
      })
    })
    describe('onFetch', () => {
      it('should not convert user ids into emails', async () => {
        const elements = generateElements(true)
        await filter.onFetch?.(elements)
        expect(elements[0].value.users[0].user.id).toEqual('11111')
      })
    })
    describe('preDeploy', () => {
      it('should not convert emails into user ids', async () => {
        const elements = generateElements(false)
        await filter.preDeploy?.(elements.map(e => toChange({ after: e })))
        expect(elements[0].value.users[0].user.id).toEqual('uri1@salto.io')
      })
    })
    describe('onDeploy', () => {
      it('should not convert user ids into emails', async () => {
        const elements = generateElements(true)
        await filter.onDeploy?.(elements.map(e => toChange({ after: e })))
        expect(elements[0].value.users[0].user.id).toEqual('11111')
      })
    })
  })
  describe('when convertUsersIds is on', () => {
    beforeEach(() => {
      filter = usersFilter({
        elementSource: buildElementsSourceFromElements([]),
        fetchQuery: fetchUtils.query.createMockQuery(),
        config: { ...DEFAULT_CONFIG, fetch: { convertUsersIds: true } } as UserConfig,
        definitions: {} as def.ApiDefinitions<Options>,
        sharedContext: {},
      })
    })
    describe('when there are no users', () => {
      beforeEach(() => {
        mockedGetElements.mockResolvedValue({ elements: [] })
      })
      describe('onFetch', () => {
        it('should not convert user ids into emails', async () => {
          const elements = generateElements(true)
          await filter.onFetch?.(elements)
          expect(elements[0].value.users[0].user.id).toEqual('11111')
        })
      })
      describe('preDeploy', () => {
        it('should not convert emails into user ids', async () => {
          const elements = generateElements(false)
          await filter.preDeploy?.(elements.map(e => toChange({ after: e })))
          expect(elements[0].value.users[0].user.id).toEqual('uri1@salto.io')
        })
      })
    })
    describe('when there are users', () => {
      beforeEach(() => {
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
          expect(elements[2].value.schedule_layers[0].resValue.value.users[0].user.id).toEqual('uri3@salto.io')
        })
        it('should do nothing when there are no relevant instances', async () => {
          const elements = [teamInstance]
          await filter.onFetch?.(elements)
          expect(mockedGetElements).not.toHaveBeenCalled()
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
        it('should do nothing when there are no relevant changes', async () => {
          const elements = [teamInstance]
          await filter.preDeploy?.(elements.map(e => toChange({ after: e })))
          expect(mockedGetElements).not.toHaveBeenCalled()
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
  })
})
