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
import DummyAdapter from '../src/adapter'
import * as generator from '../src/generator'

describe('dummy adapter', () => {
  const adapter = new DummyAdapter(generator.defaultParams)
  describe('deploy', () => {
    it('should be defined', () => {
      expect(adapter.deploy).toBeDefined()
    })
    it('should do nothing', async () => {
      expect(await adapter.deploy({ changes: [], groupID: ':)' })).toEqual({
        appliedChanges: [],
        errors: [],
      })
    })
  })

  describe('fetch', () => {
    it('should return the result of the generateElement command withuot modifications', async () => {
      const fetchResult = await adapter.fetch()
      expect(fetchResult).toEqual({ elements: generator.generateElements(generator.defaultParams) })
    })
  })
})
