/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { layoutDefinition, layoutDefinitionResult } from '../type_parsers/financial_layout_consts'
import { listedDefinition, emptyDefinition, emptyDefinitionOutcome } from '../type_parsers/saved_search_definition'
import {
  fullReportDefinition,
  simpleReportDefinitionResult,
  simpleReportDefinition,
} from '../type_parsers/report_definitions_consts'

describe('move environment report types change validator', () => {
  const savedsearch = savedsearchType().type
  const reportdefinition = reportdefinitionType().type
  const financiallayout = financiallayoutType().type
  const wrongFinancialLayout =
    '47cca24ac42e2ebb4092e9c8731657b1b2e3280b3459c1c224328446777d6f50@GZC@2022.2.15@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'

  let savedSearchInstance: InstanceElement
  let reportDefinitionInstance: InstanceElement
  let financialLayoutInstance: InstanceElement

  beforeEach(() => {
    savedSearchInstance = new InstanceElement('test', savedsearch, {
      definition: emptyDefinition,
      ...emptyDefinitionOutcome,
    })
    reportDefinitionInstance = new InstanceElement('test', reportdefinition, {
      definition: simpleReportDefinition,
      ...simpleReportDefinitionResult,
    })
    financialLayoutInstance = new InstanceElement('test', financiallayout, {
      layout: layoutDefinition,
      ...layoutDefinitionResult,
    })
  })
  describe('onAdd', () => {
    it('should have warning change error when moving a savedsearch instance with correct definition', async () => {
      const changeErrors = await reportTypesMoveEnvironment([toChange({ after: savedSearchInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].message).toEqual(
        'Saved Searches might reference internal IDs that are specific to their source NetSuite account. It is recommended to review the deployment in the target NetSuite account.',
      )
      expect(changeErrors[0].elemID).toEqual(savedSearchInstance.elemID)
    })

    it('should have warning change error when moving a reportdefinition instance with correct definition', async () => {
      const changeErrors = await reportTypesMoveEnvironment([toChange({ after: reportDefinitionInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].message).toEqual(
        'Report Definitions might reference internal IDs that are specific to their source NetSuite account. It is recommended to review the deployment in the target NetSuite account.',
      )
      expect(changeErrors[0].elemID).toEqual(reportDefinitionInstance.elemID)
    })

    it('should have warning change error when moving a financiallayout instance with correct definition', async () => {
      const changeErrors = await reportTypesMoveEnvironment([toChange({ after: financialLayoutInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].message).toEqual(
        'Financial Layouts might reference internal IDs that are specific to their source NetSuite account. It is recommended to review the deployment in the target NetSuite account.',
      )
      expect(changeErrors[0].elemID).toEqual(financialLayoutInstance.elemID)
    })
    it('should have change error when moving an savedsearch instance with incorrect definition', async () => {
      savedSearchInstance.value.definition = listedDefinition
      const changeErrors = await reportTypesMoveEnvironment([toChange({ after: savedSearchInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(savedSearchInstance.elemID)
    })

    it('should have change error when moving an reportdefinition instance with incorrect definition', async () => {
      reportDefinitionInstance.value.definition = fullReportDefinition
      const changeErrors = await reportTypesMoveEnvironment([toChange({ after: reportDefinitionInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(reportDefinitionInstance.elemID)
    })

    it('should have change error when moving an financiallayout instance with incorrect definition', async () => {
      financialLayoutInstance.value.layout = wrongFinancialLayout
      const changeErrors = await reportTypesMoveEnvironment([toChange({ after: financialLayoutInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(financialLayoutInstance.elemID)
    })
  })
  describe('onModify', () => {
    it('should have warning change error when moving an instance with correct definition', async () => {
      savedSearchInstance.value.definition = emptyDefinition
      const changeErrors = await reportTypesMoveEnvironment([
        toChange({ before: savedSearchInstance, after: savedSearchInstance }),
      ])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toEqual(savedSearchInstance.elemID)
    })
    it('should have change error when moving an instance with incorrect definition', async () => {
      const wrongLayoutInstance = financialLayoutInstance.clone()
      wrongLayoutInstance.value.layout = wrongFinancialLayout
      const changeErrors = await reportTypesMoveEnvironment([
        toChange({ before: financialLayoutInstance, after: wrongLayoutInstance }),
      ])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(financialLayoutInstance.elemID)
    })
  })
})
