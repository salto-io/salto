/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { getSerializedStream } from '../src/serialize'
import { awu } from '../src/collections/asynciterable'

describe('serialize', () => {
  describe('getSerializedStream', () => {
    const getSerializedStreamRes = async (items: (unknown[] | Record<string, unknown>)[]): Promise<string> => (
      (await awu(getSerializedStream(items)).toArray()).join('')
    )
    it('should match serialized strings', async () => {
      await awu([
        [],
        [[]],
        [[''], ['']],
        [['abc'], ['def']],
        [[], ['def']],
        [[''], ['']],
        [['abc'], ['def']],
        [[], ['def']],
        [[{}], [{}, {}]],
        [[{ a: { b: { c: 'd' } } }, [{ y: 'z' }]], [{}]],
        [[{}], [{}, {}], ['a', 'b', 3, undefined, null]],
        [['a', 'b'], { c: 'd' }, { e: 'f' }],
      ]).forEach(async items => expect(await getSerializedStreamRes(items)).toEqual(JSON.stringify(items)))
    })
  })
})
