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

import { getChangeData } from '@salto-io/adapter-api'
import { createCustomConditionEmptyFieldsOnAddition } from '../../../src/definitions/deploy/utils'
import { contextMock } from '../../mocks'

describe(`${createCustomConditionEmptyFieldsOnAddition.name}`, () => {
  it('should return a condition with a custom function that returns false when all fields are empty', () => {
    const { custom } = createCustomConditionEmptyFieldsOnAddition(['randomField1', 'randomField2'])
    expect(custom?.({})(contextMock)).toEqual(false)
  })

  it('should return a condition with a custom function that returns true when at least one field is not empty', () => {
    const { custom } = createCustomConditionEmptyFieldsOnAddition([
      Object.keys(getChangeData(contextMock.change).value)[0],
    ])
    expect(custom?.({})(contextMock)).toEqual(true)
  })

  it('should return true for non-addition changes', () => {
    const { custom } = createCustomConditionEmptyFieldsOnAddition([
      Object.keys(getChangeData(contextMock.change).value)[0],
    ])
    contextMock.change.action = 'modify'
    expect(custom?.({})(contextMock)).toEqual(false)
  })
})
