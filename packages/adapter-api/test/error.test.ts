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

import { createSaltoElementError, createSaltoElementErrorFromError, isSaltoError } from '../src/error'
import { ElemID } from '../src/element_id'
import { toChange } from '../src/change'
import { InstanceElement, ObjectType } from '../src/elements'

describe('create saltoElementError', () => {
  const elemId = new ElemID('adapter', 'test')
  it('should create correctly from error', () => {
    expect(
      createSaltoElementErrorFromError({
        error: new Error('test'),
        severity: 'Error',
        elemID: elemId,
      }),
    ).toEqual({
      message: 'test',
      severity: 'Error',
      elemID: elemId,
    })
  })
  it('should create correctly from message', () => {
    expect(
      createSaltoElementError({
        message: 'test',
        severity: 'Error',
        elemID: elemId,
      }),
    ).toEqual({
      message: 'test',
      severity: 'Error',
      elemID: elemId,
    })
  })
})

describe('isSaltoError', () => {
  const elemID = new ElemID('adapter', 'test')
  const instance = new InstanceElement('inst', new ObjectType({ elemID }), {})
  const change = toChange({ after: instance })
  it('should return false for non saltoErrors', () => {
    expect(isSaltoError(elemID)).toBeFalsy()
    expect(isSaltoError(instance)).toBeFalsy()
    expect(isSaltoError(change)).toBeFalsy()
  })
  it('should return true for saltoErrors', () => {
    expect(isSaltoError(createSaltoElementError({ message: 'test', severity: 'Error', elemID }))).toBeTruthy()
  })
  it('should return false for Errors', () => {
    expect(isSaltoError(new Error('test'))).toBeFalsy()
  })
})
