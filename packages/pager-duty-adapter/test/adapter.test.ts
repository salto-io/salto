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
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import {
  AdapterOperations,
  Change,
  DeployResult,
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  ObjectType,
  ProgressReporter,
  toChange,
} from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { credentialsType } from '../src/auth'
import { DEFAULT_CONFIG } from '../src/config'
import { ADAPTER_NAME, ESCALATION_POLICY_TYPE_NAME, SERVICE_TYPE_NAME, TEAM_TYPE_NAME } from '../src/constants'
import fetchMockReplies from './fetch_mock_replies.json'
import deployMockReplies from './deploy_mock_replies.json'

const nullProgressReporter: ProgressReporter = {
  reportProgress: () => '',
}

type MockReply = {
  url: string
  method: definitions.HTTPMethod
  params?: Record<string, string>
  response: unknown
}

const getMockFunction = (method: definitions.HTTPMethod, mockAxiosAdapter: MockAdapter): MockAdapter['onAny'] => {
  switch (method.toLowerCase()) {
    case 'get':
      return mockAxiosAdapter.onGet
    case 'put':
      return mockAxiosAdapter.onPut
    case 'post':
      return mockAxiosAdapter.onPost
    case 'patch':
      return mockAxiosAdapter.onPatch
    case 'delete':
      return mockAxiosAdapter.onDelete
    case 'head':
      return mockAxiosAdapter.onHead
    case 'options':
      return mockAxiosAdapter.onOptions
    default:
      return mockAxiosAdapter.onGet
  }
}

describe('adapter', () => {
  jest.setTimeout(10 * 1000)
  let mockAxiosAdapter: MockAdapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    ;([...fetchMockReplies, ...deployMockReplies] as MockReply[]).forEach(({ url, method, params, response }) => {
      const mock = getMockFunction(method, mockAxiosAdapter).bind(mockAxiosAdapter)
      const handler = mock(url, !_.isEmpty(params) ? { params } : undefined)
      handler.reply(200, response)
    })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
    jest.clearAllMocks()
  })

  describe('fetch', () => {
    describe('full', () => {
      it('should generate the right elements on fetch', async () => {
        expect(adapter.configType).toBeDefined()
        const { elements } = await adapter
          .operations({
            credentials: new InstanceElement('config', credentialsType, {
              accessToken: 'pass',
              subdomain: 'https://api.pagerduty.com',
            }),
            config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: { reportProgress: () => null } })

        expect([...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()).toEqual([
          'businessService',
          'escalationPolicy',
          'eventOrchestration',
          'schedule',
          'service',
          'team',
        ])
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'pager_duty.businessService',
          'pager_duty.businessService.instance.Sales',
          'pager_duty.businessService__team',
          'pager_duty.escalationPolicy',
          'pager_duty.escalationPolicy.instance.IT_Web_Policy@s',
          'pager_duty.escalationPolicy__escalation_rules',
          'pager_duty.escalationPolicy__escalation_rules__targets',
          'pager_duty.eventOrchestration',
          'pager_duty.eventOrchestration.instance.first_event_orch@s',
          'pager_duty.eventOrchestration__eventOrchestrationsRouter',
          'pager_duty.eventOrchestration__eventOrchestrationsRouter__catch_all',
          'pager_duty.eventOrchestration__eventOrchestrationsRouter__catch_all__actions',
          'pager_duty.eventOrchestration__eventOrchestrationsRouter__sets',
          'pager_duty.eventOrchestration__eventOrchestrationsRouter__sets__rules',
          'pager_duty.eventOrchestration__eventOrchestrationsRouter__sets__rules__actions',
          'pager_duty.eventOrchestration__eventOrchestrationsRouter__sets__rules__conditions',
          'pager_duty.eventOrchestration__team',
          'pager_duty.schedule',
          'pager_duty.schedule.instance.Bibi_is_Always_on_Call@s',
          'pager_duty.schedule__schedule_layers',
          'pager_duty.schedule__schedule_layers__users',
          'pager_duty.schedule__schedule_layers__users__user',
          'pager_duty.schedule__teams',
          'pager_duty.schedule__users',
          'pager_duty.service',
          'pager_duty.service.instance.acme_test@v',
          'pager_duty.service__alert_grouping_parameters',
          'pager_duty.service__escalation_policy',
          'pager_duty.service__incident_urgency_rule',
          'pager_duty.service__serviceOrchestration',
          'pager_duty.service__serviceOrchestration__catch_all',
          'pager_duty.service__serviceOrchestration__catch_all__actions',
          'pager_duty.service__serviceOrchestration__sets',
          'pager_duty.service__teams',
          'pager_duty.team',
          'pager_duty.team.instance.the_IT_of_ACME_inc@s',
        ])
        expect(
          elements
            .filter(isInstanceElement)
            .find(e => e.elemID.getFullName() === 'pager_duty.team.instance.the_IT_of_ACME_inc@s')?.value,
        ).toEqual({
          name: 'the IT of ACME inc',
          description: 'IT - stands for I tried to make it work',
          id: 'PRDWWGZ',
          type: 'team',
          default_role: 'manager',
        })
        const service = elements
          .filter(isInstanceElement)
          .find(e => e.elemID.getFullName() === 'pager_duty.service.instance.acme_test@v')?.value
        expect(service?.teams[0].id.elemID.getFullName()).toEqual('pager_duty.team.instance.the_IT_of_ACME_inc@s')
        expect(service?.escalation_policy.id.elemID.getFullName()).toEqual(
          'pager_duty.escalationPolicy.instance.IT_Web_Policy@s',
        )
      })
    })
  })
  describe('deploy', () => {
    let operations: AdapterOperations
    let teamType: ObjectType
    let team1: InstanceElement
    let serviceType: ObjectType
    let service1: InstanceElement
    let escalationPolicyType: ObjectType
    let escalationPolicy1: InstanceElement

    beforeEach(() => {
      teamType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, TEAM_TYPE_NAME) })
      serviceType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SERVICE_TYPE_NAME) })
      escalationPolicyType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, ESCALATION_POLICY_TYPE_NAME) })
      team1 = new InstanceElement('team1', teamType, {
        name: 'the IT of ACME inc',
        description: 'IT - stands for I tried to make it work',
        id: 'P465B8V',
        type: 'team',
        default_role: 'manager',
      })
      service1 = new InstanceElement('service1', serviceType, {
        id: 'PCR3A79',
        name: 'Core IT Services',
        description: 'new desc',
      })
      escalationPolicy1 = new InstanceElement('escalationPolicy1', escalationPolicyType, {
        name: 'IT Mainframe Policy2',
        description: 'new desc',
        escalation_rules: [
          {
            id: 'PR123456',
            escalation_delay_in_minutes: 30,
            targets: [
              {
                id: 'P123456',
                type: 'user',
              },
            ],
          },
        ],
      })

      operations = adapter.operations({
        credentials: new InstanceElement('config', credentialsType, {
          accessToken: 'pass',
          subdomain: 'https://api.pagerduty.com',
        }),
        config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
        elementsSource: buildElementsSourceFromElements([escalationPolicyType, teamType, serviceType, team1, service1]),
      })
    })

    it('should return the applied changes', async () => {
      const results: DeployResult[] = []

      const oldService = service1.clone()
      oldService.value.description = 'Managed by us, but not really'
      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: 'service1',
            changes: [toChange({ before: oldService, after: service1 })],
          },
          progressReporter: nullProgressReporter,
        }),
      )

      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: 'escalationPolicy',
            changes: [toChange({ after: escalationPolicy1 })],
          },
          progressReporter: nullProgressReporter,
        }),
      )

      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: 'team',
            changes: [toChange({ before: team1 })],
          },
          progressReporter: nullProgressReporter,
        }),
      )

      expect(results.map(res => res.appliedChanges.length)).toEqual([1, 1, 1])
      expect(results.map(res => res.errors.length)).toEqual([0, 0, 0])
      const modify = results[0].appliedChanges[0] as Change<InstanceElement>
      expect(getChangeData(modify).value.description).toEqual('new desc')
      const add = results[1].appliedChanges[0] as Change<InstanceElement>
      expect(getChangeData(add).value.name).toEqual('IT Mainframe Policy2')
    })
  })
})
