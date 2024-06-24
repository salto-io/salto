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

import { CONDITIONAL_ACCESS_POLICY_TYPE_NAME } from '../../../src/constants'
import { adjustConditionalAccessPolicy } from '../../../src/definitions/deploy/utils'
import { contextMock, modificationChangeMock } from '../../mocks'

describe(`${adjustConditionalAccessPolicy.name}`, () => {
  it('should throw an error if the value is not an object', async () => {
    const conditionalAccessPolicy = 'not an object'
    await expect(
      adjustConditionalAccessPolicy({
        value: conditionalAccessPolicy,
        typeName: CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
        context: contextMock,
      }),
    ).rejects.toThrow()
  })

  it('should return the original value if the change is not an addition', async () => {
    const conditionalAccessPolicy = {
      conditions: {
        users: {
          includeUsers: ['something'],
        },
      },
    }
    const result = await Promise.resolve(
      adjustConditionalAccessPolicy({
        value: conditionalAccessPolicy,
        typeName: CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
        context: { ...contextMock, change: modificationChangeMock },
      }),
    )
    expect(result.value).toEqual(conditionalAccessPolicy)
  })

  it('should set the includeUsers field to a default value if it is not defined', async () => {
    const conditionalAccessPolicy = {
      conditions: {
        users: {},
      },
    }
    const result = await Promise.resolve(
      adjustConditionalAccessPolicy({
        value: conditionalAccessPolicy,
        typeName: CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
        context: contextMock,
      }),
    )
    expect(result.value.conditions.users.includeUsers).toEqual(['none'])
  })

  it('should not change the includeUsers field if it is defined', async () => {
    const conditionalAccessPolicy = {
      conditions: {
        users: {
          includeUsers: ['something'],
        },
      },
    }
    const result = await Promise.resolve(
      adjustConditionalAccessPolicy({
        value: conditionalAccessPolicy,
        typeName: CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
        context: contextMock,
      }),
    )
    expect(result.value.conditions.users.includeUsers).toEqual(['something'])
  })
})
