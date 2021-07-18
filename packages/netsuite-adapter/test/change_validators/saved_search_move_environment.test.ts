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
import savedSearchesMoveEnvironment from '../../src/change_validators/saved_search_move_environment'
import { customTypes } from '../../src/types'
import { SAVED_SEARCH } from '../../src/constants'

jest.mock('../../src/saved_search_parser', () => ({
  parseDefinition: jest.fn().mockResolvedValue({
    test: 'test',
  }),
}))

describe('move environment saved search change validator', () => {
  describe('onAdd', () => {
    it('should have warning change error when moving an instance with correct definition', async () => {
      const instance = new InstanceElement('test', customTypes[SAVED_SEARCH])
      instance.value.definition = 'string'
      instance.value.test = 'test'
      const changeErrors = await savedSearchesMoveEnvironment([
        toChange({ after: instance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })
    it('should have change error when moving an instance with incorrect definition', async () => {
      const instance = new InstanceElement('test', customTypes[SAVED_SEARCH])
      instance.value.definition = 'string'
      const changeErrors = await savedSearchesMoveEnvironment([
        toChange({ after: instance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })
  })
})
