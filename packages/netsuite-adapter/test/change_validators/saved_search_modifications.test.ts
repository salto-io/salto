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
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import savedSearchesModifications from '../../src/change_validators/saved_search_modifications'
import { customTypes } from '../../src/types'
import { SAVED_SEARCH } from '../../src/constants'


describe('modify saved search change validator', () => {
  describe('onModify', () => {
    it('should have change error when modifying an instance with saved search type', async () => {
      const instance = new InstanceElement('test', customTypes[SAVED_SEARCH])
      const changeErrors = await savedSearchesModifications([
        toChange({ before: instance, after: instance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })
    it('should not have change error when modifying an instance without saved search type', async () => {
      const instances = Object.values(customTypes)
        .filter(type => type !== customTypes[SAVED_SEARCH])
        .map(type => new InstanceElement('test', type))
      const changeErrors = await savedSearchesModifications(instances
        .map(instance => toChange({ before: instance, after: instance })))
      expect(changeErrors).toHaveLength(0)
    })
  })
})
