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

import { Event } from 'jest-circus'

type TestBlock = {
  parent?: TestBlock
  name: string
}

const testBlockId = (b: TestBlock): string =>
  b.parent ? [testBlockId(b.parent), b.name].filter(x => x).join(' | ') : ''

export type EventStatus = 'start' | 'success' | 'failure'

export type TestStatusChangeEvent = {
  id: string
  type: 'test' | 'hook'
  status: EventStatus
}

export const extractStatus = (e: Event): TestStatusChangeEvent | undefined => {
  if (e.name === 'hook_start' || e.name === 'hook_success' || e.name === 'hook_failure') {
    return {
      id: testBlockId({ name: e.hook.type, parent: e.hook.parent }),
      type: 'hook',
      status: e.name.split('_')[1] as EventStatus,
    }
  }

  if (e.name === 'test_fn_start' || e.name === 'test_fn_success' || e.name === 'test_fn_failure') {
    return {
      id: testBlockId({ name: e.test.name, parent: e.test.parent }),
      type: 'test',
      status: e.name.split('_')[2] as EventStatus,
    }
  }

  return undefined
}
