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
import { stack } from '../src'

describe('stack', () => {
  describe('extractCallerFilename', () => {
    const { extractCallerFilename } = stack
    const partialFilename = 'lowerdash/test/stack.test.'

    describe('when called with an error with no stack', () => {
      const error = new Error()
      delete error.stack
      it('should return undefined', () => {
        expect(extractCallerFilename(error, partialFilename)).toBeUndefined()
      })
    })

    describe('when called with an error with an empty message', () => {
      it('should return the caller filename', () => {
        expect(extractCallerFilename(new Error(), partialFilename)).toMatch(/node_modules\/jest/)
      })
    })

    describe('when called with an error with a non-empty message', () => {
      it('should return the caller filename', () => {
        expect(extractCallerFilename(new Error('hello'), partialFilename)).toMatch(/node_modules\/jest/)
      })
    })

    describe('when the specified partialFilename is not in the stack', () => {
      it('should return the caller filename', () => {
        expect(extractCallerFilename(new Error('hello'), 'NOSUCHFILE')).toBeUndefined()
      })
    })
  })
})
