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

import {
  StaticFile,
  isEqualValues,
} from '../src/values'

describe('Values', () => {
  describe('StaticFile', () => {
    it('should have static serialize name', () =>
      expect(StaticFile.serializedTypeName).toEqual('StaticFile'))

    it('should be able to add buffer and set hash', () => {
      const ZOMGBuffer = Buffer.from('ZOMG')
      const fileFunc = new StaticFile('somefile.bp', 'some/path.ext', ZOMGBuffer)
      expect(fileFunc.content).toEqual(ZOMGBuffer)
      expect(fileFunc.hash).toEqual('4dc55a74daa147a028360ee5687389d7')
    })
    it('should not set hash if passed empty content', () => {
      const fileFunc = new StaticFile('somefile.bp', 'some/path.ext')
      expect(fileFunc.content).toBeUndefined()
      expect(fileFunc.hash).toBeUndefined()
    })
    describe('equality (direct)', () => {
      it('equals by hash', () => {
        const fileFunc1 = new StaticFile('somefile.bp', 'some/path.ext', 'ZOMG')
        const fileFunc2 = new StaticFile('somefile.bp', 'some/path.ext', 'ZOMG')
        expect(fileFunc1.isEqual(fileFunc2)).toEqual(true)
      })
      it('unequals by hash', () => {
        const fileFunc1 = new StaticFile('somefile.bp', 'some/path.ext', 'ZOMG1')
        const fileFunc2 = new StaticFile('somefile.bp', 'some/path.ext', 'ZOMG2')
        expect(fileFunc1.isEqual(fileFunc2)).toEqual(false)
      })
      it('unequals if both hashes are undefined', () => {
        const fileFunc1 = new StaticFile('somefile.bp', 'some/path.ext')
        const fileFunc2 = new StaticFile('somefile.bp', 'some/path.ext')
        expect(fileFunc1.isEqual(fileFunc2)).toEqual(false)
      })
    })
    describe('equality (via isEqualValues)', () => {
      it('equals by hash', () => {
        const fileFunc1 = new StaticFile('somefile.bp', 'some/path.ext', 'ZOMG')
        const fileFunc2 = new StaticFile('somefile.bp', 'some/path.ext', 'ZOMG')
        expect(isEqualValues(fileFunc1, fileFunc2)).toEqual(true)
      })
      it('unequals by hash', () => {
        const fileFunc1 = new StaticFile('somefile.bp', 'some/path.ext', 'ZOMG1')
        const fileFunc2 = new StaticFile('somefile.bp', 'some/path.ext', 'ZOMG2')
        expect(isEqualValues(fileFunc1, fileFunc2)).toEqual(false)
      })
      it('unequals if both hashes are undefined', () => {
        const fileFunc1 = new StaticFile('somefile.bp', 'some/path.ext')
        const fileFunc2 = new StaticFile('somefile.bp', 'some/path.ext')
        expect(isEqualValues(fileFunc1, fileFunc2)).toEqual(false)
      })
    })
  })
})
