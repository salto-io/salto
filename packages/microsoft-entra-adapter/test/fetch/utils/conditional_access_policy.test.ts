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

import {
  CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
  EXCLUDE_USERS_FIELD_NAME,
  INCLUDE_USERS_FIELD_NAME,
} from '../../../src/constants'
import { adjustConditionalAccessPolicy } from '../../../src/definitions/fetch/utils'

describe(`${adjustConditionalAccessPolicy.name}`, () => {
  it('should throw an error when value is not an object', async () => {
    await expect(
      adjustConditionalAccessPolicy({
        value: 'not an object',
        typeName: CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
        context: {},
      }),
    ).rejects.toThrow()
  })

  it('should remove includeUser and excludeUsers fields if they do not equal ["ALL"]', async () => {
    const conditionalAccessPolicy = {
      conditions: {
        users: {
          [INCLUDE_USERS_FIELD_NAME]: ['something'],
          [EXCLUDE_USERS_FIELD_NAME]: ['something'],
          somethingElse: 'something',
        },
      },
    }
    const result = await adjustConditionalAccessPolicy({
      value: conditionalAccessPolicy,
      typeName: CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
      context: {},
    })
    expect(result.value.conditions).toEqual({ users: { somethingElse: 'something' } })
  })

  it('should not remove includeUser and excludeUsers fields if they equal ["ALL"]', async () => {
    const conditionalAccessPolicy = {
      conditions: {
        users: {
          [INCLUDE_USERS_FIELD_NAME]: ['All'],
          [EXCLUDE_USERS_FIELD_NAME]: ['All'],
          somethingElse: 'something',
        },
      },
    }
    const result = await adjustConditionalAccessPolicy({
      value: conditionalAccessPolicy,
      typeName: CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
      context: {},
    })
    expect(result.value.conditions).toEqual({
      users: {
        [INCLUDE_USERS_FIELD_NAME]: ['All'],
        [EXCLUDE_USERS_FIELD_NAME]: ['All'],
        somethingElse: 'something',
      },
    })
  })
})
