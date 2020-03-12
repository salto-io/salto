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
  FunctionExpression,
  StaticFileAssetExpression,
  isEqualValues,
} from '../src/values'

describe('Values', () => {
  describe('Function Expressions', () => {
    describe('Vanilla', () => {
      it('should be initialized', () => {
        const funcExp = new FunctionExpression('zomg', ['WAT'], 'somefile.bp')
        expect(funcExp)
          .toHaveProperty('funcName', 'zomg')
        expect(funcExp)
          .toHaveProperty('parameters', ['WAT'])
        expect(funcExp)
          .toHaveProperty('bpPath', 'somefile.bp')
      })
    })
    it('should have static serialize name', () =>
      expect(FunctionExpression.serializedTypeName).toEqual('FunctionExpression'))
    it('should have no function name aliases', () =>
      expect(FunctionExpression.functionNameAliases).toEqual([]))
    describe('equality', () => {
      it('equals', () => {
        const funcExp1 = new FunctionExpression('zomg', ['WAT'], 'somefile.bp')
        const funcExp2 = new FunctionExpression('zomg', ['WAT'], 'somefile.bp')
        expect(funcExp1.equals(funcExp2)).toEqual(true)
      })
      it('different name', () => {
        const funcExp1 = new FunctionExpression('zomg1', ['WAT'], 'somefile.bp')
        const funcExp2 = new FunctionExpression('zomg2', ['WAT'], 'somefile.bp')
        expect(funcExp1.equals(funcExp2)).toEqual(false)
      })
      it('different params', () => {
        const funcExp1 = new FunctionExpression('zomg', ['WAT1'], 'somefile.bp')
        const funcExp2 = new FunctionExpression('zomg', ['WAT2'], 'somefile.bp')
        expect(funcExp1.equals(funcExp2)).toEqual(false)
      })
      it('should ignore bp filename', () => {
        const funcExp1 = new FunctionExpression('zomg', ['WAT'], 'somefile1.bp')
        const funcExp2 = new FunctionExpression('zomg', ['WAT'], 'somefile2.bp')
        expect(funcExp1.equals(funcExp2)).toEqual(true)
      })
    })
    describe('StaticFileAssetExpression', () => {
      it('should be initialized with func expression', () => {
        const fileFunc = new StaticFileAssetExpression('file', ['some/path.ext'], 'somefile.bp')
        expect(fileFunc).toHaveProperty('relativeFileName', 'some/path.ext')
        expect(fileFunc).toHaveProperty('funcName', 'file')
      })
      it('should have static serialize name', () =>
        expect(StaticFileAssetExpression.serializedTypeName).toEqual('StaticFileAssetExpression'))
      it('should have one alias called "file"', () =>
        expect(StaticFileAssetExpression.functionNameAliases).toEqual(['file']))

      it('should be able to add buffer and set hash', () => {
        const ZOMGBuffer = Buffer.from('ZOMG')
        const fileFunc = new StaticFileAssetExpression('file', ['some/path.ext'], 'somefile.bp', ZOMGBuffer)
        expect(fileFunc.content).toEqual(ZOMGBuffer)
        expect(fileFunc.hash).toEqual('4dc55a74daa147a028360ee5687389d7')
      })
      it('should not set hash if passed empty content', () => {
        const fileFunc = new StaticFileAssetExpression('file', ['some/path.ext'], 'somefile.bp')
        expect(fileFunc.content).toBeUndefined()
        expect(fileFunc.hash).toBeUndefined()
      })

      describe('equality (direct)', () => {
        it('equals by hash', () => {
          const fileFunc1 = new StaticFileAssetExpression('file', ['some/path.ext'], 'somefile.bp', 'ZOMG')
          const fileFunc2 = new StaticFileAssetExpression('file', ['some/path.ext'], 'somefile.bp', 'ZOMG')
          expect(fileFunc1.equals(fileFunc2)).toEqual(true)
        })
        it('unequals by hash', () => {
          const fileFunc1 = new StaticFileAssetExpression('file', ['some/path.ext'], 'somefile.bp', 'ZOMG1')
          const fileFunc2 = new StaticFileAssetExpression('file', ['some/path.ext'], 'somefile.bp', 'ZOMG2')
          expect(fileFunc1.equals(fileFunc2)).toEqual(false)
        })
        it('unequals if both hashes are undefined', () => {
          const fileFunc1 = new StaticFileAssetExpression('file', ['some/path.ext'], 'somefile.bp')
          const fileFunc2 = new StaticFileAssetExpression('file', ['some/path.ext'], 'somefile.bp')
          expect(fileFunc1.equals(fileFunc2)).toEqual(false)
        })
      })
      describe('equality (via isEqualValues)', () => {
        it('equals by hash', () => {
          const fileFunc1 = new StaticFileAssetExpression('file', ['some/path.ext'], 'somefile.bp', 'ZOMG')
          const fileFunc2 = new StaticFileAssetExpression('file', ['some/path.ext'], 'somefile.bp', 'ZOMG')
          expect(isEqualValues(fileFunc1, fileFunc2)).toEqual(true)
        })
        it('unequals by hash', () => {
          const fileFunc1 = new StaticFileAssetExpression('file', ['some/path.ext'], 'somefile.bp', 'ZOMG1')
          const fileFunc2 = new StaticFileAssetExpression('file', ['some/path.ext'], 'somefile.bp', 'ZOMG2')
          expect(isEqualValues(fileFunc1, fileFunc2)).toEqual(false)
        })
        it('unequals if both hashes are undefined', () => {
          const fileFunc1 = new StaticFileAssetExpression('file', ['some/path.ext'], 'somefile.bp')
          const fileFunc2 = new StaticFileAssetExpression('file', ['some/path.ext'], 'somefile.bp')
          expect(isEqualValues(fileFunc1, fileFunc2)).toEqual(false)
        })
      })
    })
  })
})
