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

import nock from 'nock'
import _ from 'lodash'
import waitForExpect from 'wait-for-expect'
import axios from 'axios'
import {
  telemetrySender,
  EVENT_TYPES,
  TelemetryEvent,
  StackEvent,
  Tags,
  isCountEvent,
  isStackEvent,
  DEFAULT_EVENT_NAME_PREFIX as prefix,
  MAX_CONSECUTIVE_RETRIES,
} from '../src/telemetry'

describe('telemetry', () => {
  const eventByName = (name: string, events: Array<TelemetryEvent>): TelemetryEvent | undefined =>
    _(events).find(ev => ev.name === name)
  const token = '12345'
  const url = 'http://telemetry.local'
  const installationID = '8113a616-bbe6-43cb-b51d-e2e3d4c1400d'
  const app = 'test'
  const config = {
    url,
    token,
    enabled: true,
  }
  const requiredTags = { installationID, app }
  let reqEvents = [] as Array<TelemetryEvent>
  let nockScope: nock.Scope

  waitForExpect.defaults.timeout = 500
  waitForExpect.defaults.interval = 100

  beforeEach(() => {
    nockScope = nock(url, { reqheaders: { authorization: token } }).persist()
    // eslint-disable-next-line prefer-arrow-callback
    nockScope.post('/v1/events').reply(201, function reply(_url, body) {
      const parsedBody = body as { events: Array<TelemetryEvent> }
      reqEvents = parsedBody.events
    })
  })

  afterEach(() => {
    reqEvents = []
    nock.cleanAll()
  })

  it('should use custom prefix for event names', async () => {
    const telemetry = telemetrySender(config, requiredTags, 'testing')
    expect(telemetry.enabled).toBeTruthy()
    telemetry.sendCountEvent('ev1', 1, {})
    await telemetry.stop(1)

    expect(reqEvents[0].name).toEqual('testing.ev1')
  })

  it('should send events when enabled', async () => {
    const telemetry = telemetrySender(config, requiredTags)
    expect(telemetry.enabled).toBeTruthy()
    telemetry.sendCountEvent('ev1', 1, {})
    await telemetry.stop(1)

    expect(reqEvents[0].name).toEqual(`${prefix}.ev1`)
    expect(reqEvents[0].type).toEqual(EVENT_TYPES.COUNTER)
    expect(reqEvents[0].value).toEqual(1)
  })

  it('should not send events when disabled', async () => {
    const telemetry = telemetrySender({ ...config, enabled: false }, requiredTags)
    expect(telemetry.enabled).toBeFalsy()
    telemetry.sendCountEvent('ev1', 1, {})
    await telemetry.stop(1)

    expect(reqEvents.length).toEqual(0)
  })

  it('should not send a stack event if an error stack is an empty string', async () => {
    const telemetry = telemetrySender(config, requiredTags)
    Error.stackTraceLimit = -1
    const err = new Error('error')
    Error.stackTraceLimit = 10
    telemetry.sendStackEvent('err_ev', err, {})
    await telemetry.stop(1)

    expect(reqEvents.length).toEqual(0)
  })

  it('should not send a stack event if an error stack is undefined', async () => {
    const telemetry = telemetrySender(config, requiredTags)
    const errMessage = 'error'
    const err = new Error(errMessage)
    err.stack = undefined
    telemetry.sendStackEvent('err_ev', err, {})
    await telemetry.stop(1)

    expect(reqEvents.length).toEqual(0)
  })

  it('should send a stack event and should not contain the original message', async () => {
    const telemetry = telemetrySender(config, requiredTags)
    const errMessage = 'formula Role.Parent\n  \n\n oh no\t\r\n'
    const err = new Error(errMessage)
    telemetry.sendStackEvent('err_ev', err, {})
    await telemetry.stop(1)

    expect(reqEvents.length).toEqual(1)
    expect(reqEvents[0].name).toEqual(`${prefix}.err_ev`)
    expect(reqEvents[0].type).toEqual(EVENT_TYPES.STACK)

    const stackEvent = reqEvents[0] as StackEvent
    expect(stackEvent.value.join('\n')).not.toMatch(errMessage)
    expect(stackEvent.value[0]).toMatch(/at.*/)
  })

  it('should batch send multiple events with different types', async () => {
    const telemetry = telemetrySender(config, requiredTags)
    telemetry.sendStackEvent('err_ev_1', new Error('err'), {})
    telemetry.sendStackEvent('err_ev_2', new Error('err2'))
    telemetry.sendCountEvent('count_ev_1', 1)
    telemetry.sendCountEvent('count_ev_2', 2)
    await telemetry.stop(1)

    expect(reqEvents.length).toEqual(4)
    const stackEvent1 = eventByName(`${prefix}.err_ev_1`, reqEvents) as StackEvent
    const stackEvent2 = eventByName(`${prefix}.err_ev_2`, reqEvents) as StackEvent

    expect(stackEvent1.value[0]).toMatch(/at.*/)
    expect(stackEvent2.value[0]).toMatch(/at.*/)
    expect(eventByName(`${prefix}.count_ev_1`, reqEvents)?.value).toEqual(1)
    expect(eventByName(`${prefix}.count_ev_2`, reqEvents)?.value).toEqual(2)
  })

  it('should send events with custom tags', async () => {
    const telemetry = telemetrySender(config, requiredTags)
    const customTags: Tags = { sometag: 'someval', somenumbertag: 1, shouldBeSnake: 'sssss', workspaceID: '1234' }
    telemetry.sendCountEvent('ev_with_custom_tags', 1, customTags)
    telemetry.sendCountEvent('ev_without_custom_tags', 1)
    await telemetry.stop(1)

    expect(reqEvents.length).toEqual(2)
    const eventCustomTags: Tags = eventByName(`${prefix}.ev_with_custom_tags`, reqEvents)?.tags || {}
    expect(eventCustomTags.sometag).toEqual(customTags.sometag)
    expect(eventCustomTags.somenumbertag).toEqual(customTags.somenumbertag)
    expect(eventCustomTags.should_be_snake).toEqual(customTags.shouldBeSnake)
    expect(eventCustomTags.workspace_id).toEqual(customTags.workspaceID)

    const noCustomTags: Tags = eventByName(`${prefix}.ev_without_custom_tags`, reqEvents)?.tags || {}
    expect(Object.keys(noCustomTags).length).toEqual(
      Object.keys(eventCustomTags).length - Object.keys(customTags).length,
    )
    expect(noCustomTags.app).toEqual(app)
    expect(noCustomTags.installation_id).toEqual(installationID)
  })

  it('should send events without stopping the service', async () => {
    const telemetry = telemetrySender({ ...config, flushInterval: 1 }, requiredTags)
    telemetry.sendCountEvent('ev', 1)
    await waitForExpect(async () => {
      expect(reqEvents.length).toEqual(1)
    })
    await telemetry.stop(1)
    expect(telemetry.isStopped()).toBeTruthy()
  })

  it('should have os tags', async () => {
    const telemetry = telemetrySender(config, requiredTags)
    telemetry.sendCountEvent('ev1', 1)
    await telemetry.stop(1)

    expect(reqEvents[0].tags.os_arch).toBeDefined()
    expect(reqEvents[0].tags.os_platform).toBeDefined()
    expect(reqEvents[0].tags.os_release).toBeDefined()
  })

  it('should fail sending events to a misconfigured endpoint and fail without throwing exception', async () => {
    const telemetry = telemetrySender({ ...config, token: 'incorrectToken' }, requiredTags)
    telemetry.sendCountEvent('ev1', 1)
    await telemetry.stop(1)

    expect(reqEvents.length).toEqual(0)
  })

  it('should not fail when calling telemetry.stop twice', async () => {
    const telemetry = telemetrySender(config, requiredTags)
    telemetry.sendCountEvent('ev1', 1)
    await telemetry.stop(1)
    await telemetry.stop(1)
  })

  it('should be counter event using typeguards', async () => {
    const telemetry = telemetrySender(config, requiredTags)
    telemetry.sendCountEvent('ev_count', 1)
    telemetry.sendStackEvent('ev_err', new Error('err'))
    await telemetry.stop(1)

    const shouldBeCountEvent = eventByName(`${prefix}.ev_count`, reqEvents) as TelemetryEvent
    expect(isCountEvent(shouldBeCountEvent)).toBeTruthy()

    const shouldNotBeCountEvent = eventByName(`${prefix}.ev_err`, reqEvents) as TelemetryEvent
    expect(isCountEvent(shouldNotBeCountEvent)).toBeFalsy()

    shouldBeCountEvent.value = ['a']
    expect(isCountEvent(shouldBeCountEvent)).toBeFalsy()

    const illegalEventString = `
    {
      "type": "nonexistent",
      "value": 1,
      "name": "ev",
      "tags": {},
      "timestamp": ""
    }
    `
    expect(isCountEvent(JSON.parse(illegalEventString) as StackEvent)).toBeFalsy()

    const legalEventString = `
    {
      "type": "${EVENT_TYPES.COUNTER}",
      "value": 1,
      "name": "ev",
      "tags": {},
      "timestamp": ""
    }
    `
    expect(isCountEvent(JSON.parse(legalEventString) as StackEvent)).toBeTruthy()
  })

  it('should be stack event using typeguards', async () => {
    const telemetry = telemetrySender(config, requiredTags)
    telemetry.sendStackEvent('ev_err', new Error('err'))
    telemetry.sendCountEvent('ev_count', 1)
    await telemetry.stop(1)

    const shouldBeStackEvent = eventByName(`${prefix}.ev_err`, reqEvents) as TelemetryEvent
    expect(isStackEvent(shouldBeStackEvent)).toBeTruthy()

    const shouldNotBeStackEvent = eventByName(`${prefix}.ev_count`, reqEvents) as TelemetryEvent
    expect(isStackEvent(shouldNotBeStackEvent)).toBeFalsy()

    shouldBeStackEvent.value = 1
    expect(isStackEvent(shouldBeStackEvent)).toBeFalsy()

    const illegalEventString = `
    {
      "type": "nonexistent",
      "value": ["a", "b"],
      "name": "ev",
      "tags": {},
      "timestamp": ""
    }
    `
    expect(isStackEvent(JSON.parse(illegalEventString) as StackEvent)).toBeFalsy()

    const legalEventString = `
    {
      "type": "${EVENT_TYPES.STACK}",
      "value": ["a", "b"],
      "name": "ev",
      "tags": {},
      "timestamp": ""
    }
    `
    expect(isStackEvent(JSON.parse(legalEventString) as StackEvent)).toBeTruthy()
  })

  it('should stop flushing events if HTTP response code is 4xx', async () => {
    let timesHTTPCalled = 0
    let testDone = false
    nock.cleanAll()
    // eslint-disable-next-line prefer-arrow-callback
    nockScope.post('/v1/events').reply(403, function reply(_url, _body) {
      timesHTTPCalled += 1
      return 'Forbidden'
    })
    const telemetry = telemetrySender({ ...config, flushInterval: 1 }, requiredTags)
    telemetry.sendCountEvent('ev', 1)
    setTimeout(() => {
      testDone = true
    }, 100)
    await waitForExpect(() => {
      expect(telemetry.isStopped()).toBeTruthy()
      expect(timesHTTPCalled).toEqual(1)
      expect(testDone).toBeTruthy()
    })
  })

  it('should stop flushing events after maximum amount of consecutive failed retries', async () => {
    let timesHTTPCalled = 0
    let testDone = false
    nock.cleanAll()
    nockScope
      .post('/v1/events')
      .delayConnection(5000)
      // eslint-disable-next-line prefer-arrow-callback
      .reply(201, function reply(_url, _body) {
        timesHTTPCalled += 1
        return 'Created'
      })
    axios.defaults.timeout = 1
    const telemetry = telemetrySender({ ...config, flushInterval: 1 }, requiredTags)
    telemetry.sendCountEvent('ev', 1)
    setTimeout(() => {
      testDone = true
    }, 100)
    await waitForExpect(() => {
      expect(telemetry.isStopped()).toBeTruthy()
      expect(timesHTTPCalled).toEqual(MAX_CONSECUTIVE_RETRIES)
      expect(testDone).toBeTruthy()
    })
  })
})
