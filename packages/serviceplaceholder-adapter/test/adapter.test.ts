/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { ADAPTER_NAME } from '../src/constants'
// TODO update mock file -
/** 
 For fetch:
 Add the following to your adapter.nacl file to capture full logs of the responses:
 client = {
   logging = {
     responseStrategies = [
       {
         strategy = "full"
       },
     ]
    }
 } 
 then run fetch with trace-level logs:
  > SALTO_LOG_FILE=log.txt SALTO_LOG_LEVEL=trace salto fetch
 then run
  > python3 <path-to-repo>/packages/adapter-components/scripts/client/mock_replies.py <log file> fetch_mock_replies.json
 for deploy: same as above, replace fetch with deploy
 make sure to minimize and sanitize the mocks - they may contain sensitive information!
 */
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
    // TODO replace with endpoint used in validateCredentials
    mockAxiosAdapter.onGet('/api/v2/account').reply(200)
    ;([...fetchMockReplies, ...deployMockReplies] as MockReply[]).forEach(({ url, method, params, response }) => {
      const mock = getMockFunction(method, mockAxiosAdapter).bind(mockAxiosAdapter)
      const handler = mock(url, !_.isEmpty(params) ? { params } : undefined)
      handler.replyOnce(200, response)
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
              // TODO adjust
              username: 'user',
              password: 'pass',
              subdomain: 'SOME_SUBDOMAIN',
            }),
            config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: { reportProgress: () => null } })

        expect([...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()).toEqual([
          'business_hours_schedule',
          'business_hours_schedule_holiday',
          'group',
          'made_up_type_a',
          'made_up_type_b',
        ])
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'serviceplaceholder.business_hours_schedule',
          'serviceplaceholder.business_hours_schedule.instance.Some_schedule@s',
          'serviceplaceholder.business_hours_schedule__intervals',
          'serviceplaceholder.business_hours_schedule_holiday',
          'serviceplaceholder.business_hours_schedule_holiday.instance.Some_schedule__New_holiday1@suus',
          'serviceplaceholder.group',
          'serviceplaceholder.group.instance.group_1@s',
          'serviceplaceholder.group.instance.group_2@s',
          'serviceplaceholder.made_up_type_a',
          'serviceplaceholder.made_up_type_a.instance.made_up_1@s',
          'serviceplaceholder.made_up_type_a.instance.made_up_2@s',
          'serviceplaceholder.made_up_type_a.instance.made_up_3@s',
          'serviceplaceholder.made_up_type_b',
          'serviceplaceholder.made_up_type_b.instance.made_up_1@s',
        ])
        expect(
          elements
            .filter(isInstanceElement)
            .find(
              e =>
                e.elemID.getFullName() ===
                'serviceplaceholder.business_hours_schedule_holiday.instance.Some_schedule__New_holiday1@suus',
            )?.value,
        ).toEqual({
          end_date: '2024-02-21',
          end_year: '2024',
          id: 4442618333587,
          name: 'New holiday1',
          start_date: '2024-02-20',
          start_year: '2024',
        })
        const madeUp2Values = elements
          .filter(isInstanceElement)
          .find(e => e.elemID.getFullName() === 'serviceplaceholder.made_up_type_a.instance.made_up_2@s')?.value
        expect(madeUp2Values?.parent_id?.elemID?.fullName).toEqual(
          'serviceplaceholder.made_up_type_a.instance.made_up_1@s',
        )
        expect(madeUp2Values?.other_b?.elemID?.fullName).toEqual(
          'serviceplaceholder.made_up_type_b.instance.made_up_1@s',
        )
        const madeUp3Values = elements
          .filter(isInstanceElement)
          .find(e => e.elemID.getFullName() === 'serviceplaceholder.made_up_type_a.instance.made_up_3@s')?.value
        expect(madeUp3Values?.parent_id?.elemID?.fullName).toEqual(
          'serviceplaceholder.made_up_type_b.instance.made_up_1@s',
        )
      })
    })
  })
  describe('deploy', () => {
    let operations: AdapterOperations
    let groupType: ObjectType
    let businessHoursScheduleType: ObjectType
    let group1: InstanceElement
    let schedule1: InstanceElement

    beforeEach(() => {
      // TODO update to relevant changes
      groupType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'group') })
      businessHoursScheduleType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'business_hours_schedule') })
      group1 = new InstanceElement('group1', groupType, { name: 'group1', is_public: 'false', id: 1234 })
      schedule1 = new InstanceElement('My_Schedule@s', businessHoursScheduleType, {
        name: 'My Schedule',
        time_zone: 'Pacific Time (US & Canada)',
        intervals: [
          {
            start_time: 1980,
            end_time: 2460,
          },
          {
            start_time: 3420,
            end_time: 3900,
          },
          {
            start_time: 4860,
            end_time: 5340,
          },
          {
            start_time: 6300,
            end_time: 6780,
          },
          {
            start_time: 7740,
            end_time: 8220,
          },
        ],
      })

      operations = adapter.operations({
        credentials: new InstanceElement('config', credentialsType, {
          username: 'user123',
          password: 'pwd456',
          subdomain: 'myBrand',
        }),
        config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
        elementsSource: buildElementsSourceFromElements([groupType, businessHoursScheduleType, group1, schedule1]),
      })
    })

    it('should return the applied changes', async () => {
      const results: DeployResult[] = []
      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: 'group',
            changes: [toChange({ after: new InstanceElement('new_group@s', groupType, { name: 'new group' }) })],
          },
          progressReporter: nullProgressReporter,
        }),
      )
      const updatedGroup1 = group1.clone()
      updatedGroup1.value.name = 'new name'
      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: 'group',
            changes: [
              toChange({
                before: group1,
                after: updatedGroup1,
              }),
            ],
          },
          progressReporter: nullProgressReporter,
        }),
      )

      results.push(
        await operations.deploy({
          changeGroup: {
            groupID: 'group',
            changes: [
              toChange({
                after: new InstanceElement('schedule2', businessHoursScheduleType, {
                  name: 'schedule2',
                  time_zone: 'Pacific Time (US & Canada)',
                  intervals: [
                    {
                      start_time: 1980,
                      end_time: 2460,
                    },
                    {
                      start_time: 3420,
                      end_time: 3900,
                    },
                  ],
                }),
              }),
            ],
          },
          progressReporter: nullProgressReporter,
        }),
      )

      expect(results.map(res => res.appliedChanges.length)).toEqual([1, 1, 1])
      expect(results.map(res => res.errors.length)).toEqual([0, 0, 0])
      const addRes = results[0].appliedChanges[0] as Change<InstanceElement>
      expect(getChangeData(addRes).value.id).toEqual(12345)
    })
  })
})
