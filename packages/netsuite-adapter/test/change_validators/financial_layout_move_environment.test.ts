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
import { financiallayoutType } from '../../src/autogen/types/standard_types/financiallayout'
import financialLayoutMoveEnvironment from '../../src/change_validators/financial_layout_move_enironment'

jest.mock('../../src/financial_layout_parsing/financial_layout_parser', () => ({
  parseDefinition: jest.fn().mockResolvedValue({
    test: 'test',
  }),
}))

describe('move environment financial layout change validator', () => {
  const financiallayout = financiallayoutType().type
  describe('onAdd', () => {
    it('should have change error Warning when adding with legal definition', async () => {
      const instance = new InstanceElement('test', financiallayout)
      instance.value.layout = 'string'
      instance.value.test = 'test'
      const changeErrors = await financialLayoutMoveEnvironment([toChange({ after: instance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })

    it('should have change error Error when adding with incorrect definition', async () => {
      const instance = new InstanceElement('test', financiallayout)
      instance.value.layout = 'string'
      const changeErrors = await financialLayoutMoveEnvironment([toChange({ after: instance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })
  })

  describe('onModify', () => {
    it('should have an Error when deploying a modified financial layout', async () => {
      const instance = new InstanceElement('test', financiallayout)
      instance.value.layout = 'string'
      instance.value.test = 'modified test value'
      const changeErrors = await financialLayoutMoveEnvironment([toChange({ before: instance, after: instance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })
  })
})
