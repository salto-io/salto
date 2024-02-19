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
import { BuiltinTypes, ElemID } from '@salto-io/adapter-api'
import { createInMemoryElementSource, RemoteElementSource } from '../../src/workspace/elements_source'

describe('RemoteElementSource', () => {
  let elemSource: RemoteElementSource
  beforeEach(() => {
    elemSource = createInMemoryElementSource([BuiltinTypes.NUMBER, BuiltinTypes.BOOLEAN])
  })
  describe('has', () => {
    it('should return true when element exists', async () => {
      expect(await elemSource.has(BuiltinTypes.NUMBER.elemID)).toEqual(true)
    })
    it('should return false when element does not exist', async () => {
      expect(await elemSource.has(new ElemID('dummy', 'not-exist'))).toEqual(false)
    })
  })
  describe('rename', () => {
    it('should throw', () => {
      expect(() => elemSource.rename('test')).toThrow()
    })
  })
  describe('isEmpty', () => {
    it('should return false when there are elements', async () => {
      expect(await elemSource.isEmpty()).toEqual(false)
    })
    it('should return true when there are no elements', async () => {
      expect(await createInMemoryElementSource([]).isEmpty()).toEqual(true)
    })
  })
})
