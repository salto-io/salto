
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

import { getEvents, buildEventName, CliTelemetry, getCliTelemetry } from '../src/telemetry'
import { getMockTelemetry, MockTelemetry } from './mocks'

describe('telemetry event names', () => {
  let mockTelemetry: MockTelemetry
  let cliTelemetry: CliTelemetry

  beforeEach(() => {
    mockTelemetry = getMockTelemetry()
  })

  it('should send success events without tags', () => {
    const command = 'import'
    cliTelemetry = getCliTelemetry(mockTelemetry, command)
    cliTelemetry.success()

    expect(mockTelemetry.getEvents()).toHaveLength(1)
    expect(mockTelemetry.getEventsMap()).toHaveProperty([getEvents(command).success])
  })

  it('should send success events with tags', () => {
    const command = 'import'
    const tags = { someTag: 'someValue' }
    cliTelemetry = getCliTelemetry(mockTelemetry, command)
    cliTelemetry.success(tags)

    expect(mockTelemetry.getEvents()).toHaveLength(1)
    expect(mockTelemetry.getEventsMap()).toHaveProperty([getEvents(command).success])
    expect(mockTelemetry.getEventsMap()[getEvents(command).success]).toHaveLength(1)
    expect(mockTelemetry.getEventsMap()[getEvents(command).success][0].tags).toHaveProperty('someTag')
    expect(mockTelemetry.getEventsMap()[getEvents(command).success][0].tags.someTag)
      .toEqual(tags.someTag)
  })

  it('should send mergeErrors events with some value > 1', () => {
    const command = 'import'
    const value = 42
    cliTelemetry = getCliTelemetry(mockTelemetry, command)
    cliTelemetry.mergeErrors(42)

    expect(mockTelemetry.getEvents()).toHaveLength(1)
    expect(mockTelemetry.getEventsMap()).toHaveProperty([getEvents(command).mergeErrors])
    expect(mockTelemetry.getEventsMap()[getEvents(command).mergeErrors][0].value).toEqual(value)
  })

  it('should get events for some command name', () => {
    expect(getEvents('ev')).toHaveProperty('start')
    expect(getEvents('ev').start).toEqual('workspace.ev.start')
  })

  it('should build event name for a some command', () => {
    expect(buildEventName('some', 'start')).toEqual('workspace.some.start')
  })
})
