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
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import { reportdefinitionType } from '../../src/autogen/types/standard_types/reportdefinition'
import reportDefinitionMoveEnvironment from '../../src/change_validators/report_definition_move_environment'

jest.mock('../../src/report_definition_parsing/report_definition_parser', () => ({
  parseDefinition: jest.fn().mockResolvedValue({
    test: 'test',
  }),
}))

describe('move environment saved search change validator', () => {
  const reportdefinition = reportdefinitionType().type
  describe('onAdd', () => {
    it('should have warning change error when moving an instance with correct definition', async () => {
      const instance = new InstanceElement('test', reportdefinition)
      instance.value.definition = 'string'
      instance.value.test = 'test'
      const changeErrors = await reportDefinitionMoveEnvironment([
        toChange({ after: instance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })
    it('should have change error when moving an instance with incorrect definition', async () => {
      const instance = new InstanceElement('test', reportdefinition)
      instance.value.definition = 'string'
      const changeErrors = await reportDefinitionMoveEnvironment([
        toChange({ after: instance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })
  })
  describe('onModify', () => {
    it('should have warning change error when moving an instance with correct definition', async () => {
      const instance = new InstanceElement('test', reportdefinition)
      instance.value.definition = 'string'
      instance.value.test = 'test'
      const changeErrors = await reportDefinitionMoveEnvironment([
        toChange({ before: instance, after: instance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })
    it('should have change error when moving an instance with incorrect definition', async () => {
      const instance = new InstanceElement('test', reportdefinition)
      instance.value.definition = 'string'
      const changeErrors = await reportDefinitionMoveEnvironment([
        toChange({ before: instance, after: instance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })
  })
})
