/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { createElementQuery, ElementQuery } from '../../src/elements/query'

describe('query', () => {
  describe('createElementsQuery', () => {
    let query: ElementQuery
    beforeEach(() => {
      query = createElementQuery({
        include: [
          {
            type: 'type1.*',
          },
        ],
        exclude: [
          {
            type: 'type12.*',
          },
        ],
      })
    })

    it('isTypeMatch should return true if the type matches the include but not the exclude', () => {
      expect(query.isTypeMatch('type11')).toBeTruthy()
    })

    it('isTypeMatch should return false if the type matches the include and the exclude', () => {
      expect(query.isTypeMatch('type12')).toBeFalsy()
    })

    it('isTypeMatch should return false if the type does not match the include', () => {
      expect(query.isTypeMatch('atype11')).toBeFalsy()
    })
  })
})
