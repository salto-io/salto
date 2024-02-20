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

import { makeResolvablePromise, Resolvable } from '@salto-io/test-utils'

import { Change, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { promises } from '@salto-io/lowerdash'
import { ZENDESK } from '../src/constants'
import { deployChangesSequentially } from '../src/deployment'

const { sleep } = promises.timeout
const mockDeployChangeFunc = jest.fn()

describe('deployChangesSequentially', () => {
  let p: Resolvable<number>
  const routingAttribute1 = new InstanceElement(
    'Test1',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'routing_attribute') }),
    { name: 'Test', values: [] },
  )
  const routingAttribute2 = new InstanceElement(
    'Test2',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'routing_attribute') }),
    { name: 'Test', values: [] },
  )

  beforeEach(async () => {
    p = makeResolvablePromise(0)
    jest.clearAllMocks()
    mockDeployChangeFunc.mockImplementation(async (_change: Change): Promise<void> => {
      await p.promise
    })
  })
  it('should work correctly', async () => {
    const change1: Change = { action: 'add', data: { after: routingAttribute1 } }
    const change2: Change = { action: 'add', data: { after: routingAttribute2 } }
    const res = deployChangesSequentially([change1, change2], mockDeployChangeFunc)
    await sleep(1)
    expect(mockDeployChangeFunc).toHaveBeenCalledTimes(1)
    expect(mockDeployChangeFunc).toHaveBeenCalledWith({ action: 'add', data: { after: routingAttribute1 } })
    p.resolve()
    await p.promise
    await sleep(1)
    expect(mockDeployChangeFunc).toHaveBeenCalledTimes(2)
    expect(mockDeployChangeFunc).toHaveBeenLastCalledWith({ action: 'add', data: { after: routingAttribute2 } })
    expect(await res).toEqual({
      appliedChanges: [
        { action: 'add', data: { after: routingAttribute1 } },
        { action: 'add', data: { after: routingAttribute2 } },
      ],
      errors: [],
    })
  })
})
