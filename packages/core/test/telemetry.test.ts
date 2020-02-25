
/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { telemetrySender, EVENT_TYPES, TelemetryEvent, StackEvent, Tags } from '../src/telemetry'

describe('telemetry', () => {
  const eventByName = (
    name: string,
    events: Array<TelemetryEvent>
  ): TelemetryEvent | undefined => _(events).find(ev => ev.name === name)
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

  beforeEach(() => {
    const s = nock(url, { reqheaders: { authorization: token } }).persist()
    // eslint-disable-next-line prefer-arrow-callback
    s.post(/.*/).reply(201, function reply(_url, body) {
      const parsedBody = body as { events: Array<TelemetryEvent> }
      reqEvents = parsedBody.events
    })
  })

  afterEach(() => {
    reqEvents = []
    nock.cleanAll()
  })

  it('should send events when enabled', async () => {
    const telemetry = telemetrySender(config, requiredTags)
    expect(telemetry.enabled).toBeTruthy()
    telemetry.sendCountEvent('ev1', 1, {})
    await telemetry.stop(1)

    expect(reqEvents[0].name).toEqual('ev1')
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
    expect(reqEvents[0].name).toEqual('err_ev')
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
    const stackEvent1 = eventByName('err_ev_1', reqEvents) as StackEvent
    const stackEvent2 = eventByName('err_ev_2', reqEvents) as StackEvent

    expect(stackEvent1.value[0]).toMatch(/at.*/)
    expect(stackEvent2.value[0]).toMatch(/at.*/)
    expect(eventByName('count_ev_1', reqEvents)?.value).toEqual(1)
    expect(eventByName('count_ev_2', reqEvents)?.value).toEqual(2)
  })

  it('should send events with custom tags', async () => {
    const telemetry = telemetrySender(config, requiredTags)
    const customTags: Tags = { sometag: 'someval', somenumbertag: 1, shouldBeSnake: 'sssss', workspaceID: '1234' }
    telemetry.sendCountEvent('ev_with_custom_tags', 1, customTags)
    telemetry.sendCountEvent('ev_without_custom_tags', 1)
    await telemetry.stop(1)

    expect(reqEvents.length).toEqual(2)
    const eventCustomTags = eventByName('ev_with_custom_tags', reqEvents)?.tags || {}
    expect(eventCustomTags.sometag).toEqual(customTags.sometag)
    expect(eventCustomTags.somenumbertag).toEqual(customTags.somenumbertag)
    expect(eventCustomTags.should_be_snake).toEqual(customTags.shouldBeSnake)
    expect(eventCustomTags.workspace_id).toEqual(customTags.workspaceID)

    const noCustomTags = eventByName('ev_without_custom_tags', reqEvents)?.tags || {}
    expect(Object.keys(noCustomTags).length)
      .toEqual(Object.keys(eventCustomTags).length - Object.keys(customTags).length)
    expect(noCustomTags.app).toEqual(app)
    expect(noCustomTags.installation_id).toEqual(installationID)
  })

  it('should send events without stopping the service', async () => {
    const telemetry = telemetrySender({ ...config, flushInterval: 1 }, requiredTags)
    telemetry.sendCountEvent('ev', 1)
    setTimeout(async () => {
      expect(reqEvents.length).toEqual(1)
      await telemetry.stop(1)
    }, 2)
  })

  it('should have os tags', async () => {
    const telemetry = telemetrySender(config, requiredTags)
    telemetry.sendCountEvent('ev1', 1)
    await telemetry.stop(1)

    expect(reqEvents[0].tags.os_arch).not.toBeUndefined()
    expect(reqEvents[0].tags.os_platform).not.toBeUndefined()
    expect(reqEvents[0].tags.os_release).not.toBeUndefined()
  })

  it('should fail sending events to a misconfigured endpoint and fail without throwing exception', async () => {
    const telemetry = telemetrySender({ ...config, token: 'incorrectToken' }, requiredTags)
    telemetry.sendCountEvent('ev1', 1)
    await telemetry.stop(1)

    expect(reqEvents.length).toEqual(0)
  })
})
