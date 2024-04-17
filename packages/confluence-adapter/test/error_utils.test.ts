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

import { ElemID } from '@salto-io/adapter-api'
import { customConvertError } from '../src/error_utils'

describe('customConvertError', () => {
  const elemID = new ElemID('testElemID')
  it('should return the error when it is error SaltoError', () => {
    const error = {
      elemID: new ElemID('mock'),
      message: 'mock',
      name: 'mock',
      severity: 'Error',
      response: { data: { errors: [{ title: 'Version error' }] }, status: 409 },
    } as Error
    const result = customConvertError(elemID, error)
    expect(result).toEqual(error)
  })
  describe('Version error', () => {
    it('should return message from the error array, when error is in the correct version error structure', () => {
      const error = {
        message: 'mock',
        name: 'mock',
        response: { data: { errors: [{ title: 'Version error' }] }, status: 409 },
      } as Error

      const result = customConvertError(elemID, error)

      expect(result).toEqual({
        message: 'Version error',
        severity: 'Error',
        elemID,
      })
    })

    it('should return error.message when error has no response', () => {
      const error = {
        message: 'mock',
        name: 'mock',
      } as Error
      const result = customConvertError(elemID, error)
      expect(result).toEqual({
        message: 'mock',
        severity: 'Error',
        elemID,
      })
    })
    it('should return error.message when status is not 409', () => {
      const error = {
        message: 'mock',
        name: 'mock',
        response: { data: { errors: [{ title: 'Test error' }] }, status: 408 },
      } as Error
      const result = customConvertError(elemID, error)
      expect(result).toEqual({
        message: 'mock',
        severity: 'Error',
        elemID,
      })
    })
    it('should return error.message when errors array is empty', () => {
      const error = {
        message: 'mock',
        name: 'mock',
        response: { data: { errors: [] }, status: 409 },
      } as Error
      const result = customConvertError(elemID, error)
      expect(result).toEqual({
        message: 'mock',
        severity: 'Error',
        elemID,
      })
    })
    it('should return error.message when title is undefined', () => {
      const error = {
        message: 'mock',
        name: 'mock',
        response: { data: { errors: [{ title: undefined }] }, status: 409 },
      } as Error
      const result = customConvertError(elemID, error)
      expect(result).toEqual({
        message: 'mock',
        severity: 'Error',
        elemID,
      })
    })
    it('should return error.message when title does not start with "Version"', () => {
      const error = {
        message: 'mock',
        name: 'mock',
        response: { data: { errors: [{ title: 'Not Version error' }] }, status: 409 },
      } as Error
      const result = customConvertError(elemID, error)
      expect(result).toEqual({
        message: 'mock',
        severity: 'Error',
        elemID,
      })
    })
  })
  describe('Java NullPointer exception', () => {
    it('should return undefined when error is java.NullPointer exception', () => {
      const error = {
        message: 'mock',
        name: 'mock',
        response: { data: { message: 'java.lang.NullPointerException: Cannot invoke something' }, status: 500 },
      } as Error
      const result = customConvertError(elemID, error)
      expect(result).toBeUndefined()
    })
    it('should return error message when status is 500 but error is not java NullPointer', () => {
      const error = {
        message: 'mock',
        name: 'mock',
        response: { data: { message: 'blabla' }, status: 500 },
      } as Error
      const result = customConvertError(elemID, error)
      expect(result?.message).toEqual('mock')
    })
  })
})
