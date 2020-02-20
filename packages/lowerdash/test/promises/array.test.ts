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
import _ from 'lodash'
import { promiseAllChained } from '../../src/promises/array'

describe('promiseAllChained', () => {
  it('should run in chunks', async () => {
    const order: string[] = []
    const chunkSize = 7
    const func = (n: number): () => Promise<number> => () => {
      order.push(`start-${n}`)
      return new Promise(resolve => setTimeout(resolve, 1)).then(_r => {
        order.push(`end-${n}`)
        return n
      })
    }
    const numbers = [...Array(100).keys()]

    await promiseAllChained(numbers.map(n => func(n)), chunkSize)

    const expectedResult = _.flatten(_.chunk(numbers, chunkSize)
      .map(chunk => [...chunk.map(n => `start-${n}`), ...chunk.map(n => `end-${n}`)]))
    expect(order).toEqual(expectedResult)
  })
})
