/*
*                      Copyright 2021 Salto Labs Ltd.
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
/*
*                      Copyright 2021 Salto Labs Ltd.
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { simpleGetArgs } from '../../../src/elements/ducktype/transformer'

describe('ducktype_transformer', () => {
  describe('simpleGetArgs', () => {
    it('should pass standard args as provided', () => {
      expect(simpleGetArgs({ url: '/a/b/c' })).toEqual([{
        endpointName: '/a/b/c',
        paginationField: undefined,
        queryArgs: undefined,
        recursiveQueryArgs: undefined,
      }])
      expect(simpleGetArgs({
        url: '/ep', paginationField: 'page', queryParams: { arg1: 'val1' },
      })).toEqual([{
        endpointName: '/ep',
        paginationField: 'page',
        queryArgs: { arg1: 'val1' },
        recursiveQueryArgs: undefined,
      }])
    })

    it('should convert recursiveQueryArgs to functions', () => {
      const res = simpleGetArgs({
        url: '/a/b/c',
        recursiveQueryByResponseField: {
          ref: 'referenced',
          parentId: 'id',
        },
      })
      expect(res).toEqual([{
        endpointName: '/a/b/c',
        recursiveQueryArgs: {
          ref: expect.anything(),
          parentId: expect.anything(),
        },
        paginationField: undefined,
        queryArgs: undefined,
      }])
      expect(res[0].recursiveQueryArgs?.ref({ a: 'a', b: 'b', referenced: 'val' })).toEqual('val')
      expect(res[0].recursiveQueryArgs?.parentId({ a: 'a', b: 'b', referenced: 'val' })).toBeUndefined()
      expect(res[0].recursiveQueryArgs?.parentId({ id: 'id' })).toEqual('id')
    })
  })

  // TODO add tests for getTypeAndInstances, getAllElements
})
