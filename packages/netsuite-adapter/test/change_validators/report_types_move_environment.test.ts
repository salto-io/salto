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
import { savedsearchType } from '../../src/autogen/types/standard_types/savedsearch'
import { reportdefinitionType } from '../../src/autogen/types/standard_types/reportdefinition'
import { financiallayoutType } from '../../src/autogen/types/standard_types/financiallayout'
import reportTypesMoveEnvironment from '../../src/change_validators/report_types_move_environment'

jest.mock('../../src/saved_search_parsing/saved_search_parser', () => ({
  parseDefinition: jest.fn().mockResolvedValue({
    test: 'test',
  }),
}))

jest.mock('../../src/report_definition_parsing/report_definition_parser', () => ({
  parseDefinition: jest.fn().mockResolvedValue({
    test: 'test',
  }),
}))

jest.mock('../../src/financial_layout_parsing/financial_layout_parser', () => ({
  parseDefinition: jest.fn().mockResolvedValue({
    test: 'test',
  }),
}))

describe('move environment saved search change validator', () => {
  const savedsearch = savedsearchType().type
  const reportdefinition = reportdefinitionType().type
  const financiallayout = financiallayoutType().type

  let savedSearchInstance: InstanceElement
  let reportDefinitionInstance: InstanceElement
  let financialLayoutInstance: InstanceElement

  beforeEach(() => {
    savedSearchInstance = new InstanceElement('test', savedsearch, { definition: 'string' })
    reportDefinitionInstance = new InstanceElement('test', reportdefinition, { definition: 'string' })
    financialLayoutInstance = new InstanceElement('test', financiallayout, { layout: 'string' })
  })
  describe('onAdd', () => {
    it('should have warning change error when moving a savedsearch instance with correct definition', async () => {
      savedSearchInstance.value.test = 'test'
      const changeErrors = await reportTypesMoveEnvironment([
        toChange({ after: savedSearchInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].message).toEqual('Beware that saved search might reference internal ids that are not correct for the current environment. It is recommended that you verify the deployment in NetSuite UI.')
      expect(changeErrors[0].elemID).toEqual(savedSearchInstance.elemID)
    })

    it('should have warning change error when moving a reportdefinition instance with correct definition', async () => {
      reportDefinitionInstance.value.test = 'test'
      const changeErrors = await reportTypesMoveEnvironment([
        toChange({ after: reportDefinitionInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].message).toEqual('Beware that report definition might reference internal ids that are not correct for the current environment. It is recommended that you verify the deployment in NetSuite UI.')
      expect(changeErrors[0].elemID).toEqual(reportDefinitionInstance.elemID)
    })

    it('should have warning change error when moving a financiallayout instance with correct definition', async () => {
      financialLayoutInstance.value.test = 'test'
      const changeErrors = await reportTypesMoveEnvironment([
        toChange({ after: financialLayoutInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].message).toEqual('Beware that financial layout might reference internal ids that are not correct for the current environment. It is recommended that you verify the deployment in NetSuite UI.')
      expect(changeErrors[0].elemID).toEqual(financialLayoutInstance.elemID)
    })
    it('should have change error when moving an savedsearch instance with incorrect definition', async () => {
      const changeErrors = await reportTypesMoveEnvironment([
        toChange({ after: savedSearchInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(savedSearchInstance.elemID)
    })

    it('should have change error when moving an reportdefinition instance with incorrect definition', async () => {
      const changeErrors = await reportTypesMoveEnvironment([
        toChange({ after: reportDefinitionInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(reportDefinitionInstance.elemID)
    })

    it('should have change error when moving an financiallayout instance with incorrect definition', async () => {
      const changeErrors = await reportTypesMoveEnvironment([
        toChange({ after: financialLayoutInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(financialLayoutInstance.elemID)
    })
  })
  describe('onModify', () => {
    it('should have warning change error when moving an instance with correct definition', async () => {
      savedSearchInstance.value.test = 'test'
      const changeErrors = await reportTypesMoveEnvironment([
        toChange({ before: savedSearchInstance, after: savedSearchInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toEqual(savedSearchInstance.elemID)
    })
    it('should have change error when moving an instance with incorrect definition', async () => {
      const changeErrors = await reportTypesMoveEnvironment([
        toChange({ before: financialLayoutInstance, after: financialLayoutInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(financialLayoutInstance.elemID)
    })
  })
})
