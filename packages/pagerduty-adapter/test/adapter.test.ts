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
              subdomain: 'salto',
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
          'scheduleLayer',
          'service',
          'team',
        ])
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'pagerduty.businessService',
          'pagerduty.businessService.instance.Sales',
          'pagerduty.businessService__team',
          'pagerduty.escalationPolicy',
          'pagerduty.escalationPolicy.instance.IT_Web_Policy@s',
          'pagerduty.escalationPolicy__escalation_rules',
          'pagerduty.escalationPolicy__escalation_rules__targets',
          'pagerduty.eventOrchestration',
          'pagerduty.eventOrchestration.instance.first_event_orch@s',
          'pagerduty.eventOrchestration__eventOrchestrationsRouter',
          'pagerduty.eventOrchestration__eventOrchestrationsRouter__catch_all',
          'pagerduty.eventOrchestration__eventOrchestrationsRouter__catch_all__actions',
          'pagerduty.eventOrchestration__eventOrchestrationsRouter__sets',
          'pagerduty.eventOrchestration__eventOrchestrationsRouter__sets__rules',
          'pagerduty.eventOrchestration__eventOrchestrationsRouter__sets__rules__actions',
          'pagerduty.eventOrchestration__eventOrchestrationsRouter__sets__rules__conditions',
          'pagerduty.eventOrchestration__team',
          'pagerduty.schedule',
          'pagerduty.schedule.instance.Bibi_is_Always_on_Call@s',
          'pagerduty.scheduleLayer',
          'pagerduty.scheduleLayer.instance.Bibi_is_Always_on_Call__Weekly_On_call@ssssuusb',
          'pagerduty.scheduleLayer__users',
          'pagerduty.scheduleLayer__users__user',
          'pagerduty.schedule__teams',
          'pagerduty.service',
          'pagerduty.service.instance.acme_test@v',
          'pagerduty.service__alert_grouping_parameters',
          'pagerduty.service__escalation_policy',
          'pagerduty.service__incident_urgency_rule',
          'pagerduty.service__serviceOrchestration',
          'pagerduty.service__serviceOrchestration__catch_all',
          'pagerduty.service__serviceOrchestration__catch_all__actions',
          'pagerduty.service__serviceOrchestration__sets',
          'pagerduty.service__teams',
          'pagerduty.team',
          'pagerduty.team.instance.the_IT_of_ACME_inc@s',
        ])
        expect(
          elements
            .filter(isInstanceElement)
            .find(e => e.elemID.getFullName() === 'pagerduty.team.instance.the_IT_of_ACME_inc@s')?.value,
        ).toEqual({
          name: 'the IT of ACME inc',
          description: 'IT - stands for I tried to make it work',
          id: 'PRDWWGZ',
          type: 'team',
          default_role: 'manager',
        })
        const service = elements
          .filter(isInstanceElement)
          .find(e => e.elemID.getFullName() === 'pagerduty.service.instance.acme_test@v')?.value
        expect(service?.teams[0].id.elemID.getFullName()).toEqual('pagerduty.team.instance.the_IT_of_ACME_inc@s')
        expect(service?.escalation_policy.id.elemID.getFullName()).toEqual(
          'pagerduty.escalationPolicy.instance.IT_Web_Policy@s',
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
          subdomain: 'salto',
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
