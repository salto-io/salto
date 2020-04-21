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
import State from '../../src/workspace/state'

const mockState = (services: string[] = []): State => ({
  list: jest.fn().mockImplementation(() => Promise.resolve([])),
  get: jest.fn().mockImplementation(() => Promise.resolve()),
  getAll: jest.fn().mockImplementation(() => Promise.resolve([])),
  set: jest.fn().mockImplementation(() => Promise.resolve()),
  remove: jest.fn().mockImplementation(() => Promise.resolve()),
  override: jest.fn().mockImplementation(() => Promise.resolve()),
  flush: jest.fn().mockImplementation(() => Promise.resolve()),
  getServicesUpdateDates: jest.fn().mockImplementation(() => Promise.resolve()),
  existingServices: jest.fn().mockImplementation(() => Promise.resolve(services)),
})

export default mockState
