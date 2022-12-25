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
import { collections } from '@salto-io/lowerdash'
import { ChangeValidator, getChangeData, InstanceElement,
  isInstanceChange, ChangeError, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FINANCIAL_LAYOUT, REPORT_DEFINITION, SAVED_SEARCH } from '../constants'
import { parseDefinition as parseSavedSearchDefinition, SavedSearchType } from '../saved_search_parsing/saved_search_parser'
import { parseDefinition as parseReportDefintionDefinition } from '../report_definition_parsing/report_definition_parser'
import { parseDefinition as parseFinancialLayoutDefinition } from '../financial_layout_parsing/financial_layout_parser'
import { typeToParameters } from '../report_types_parser_utils'
import { ReportDefinitionType } from '../report_definition_parsing/parsed_report_definition'
import { FinancialLayoutType } from '../financial_layout_parsing/parsed_financial_layout'

const { awu } = collections.asynciterable

export type ReportTypes = SavedSearchType | ReportDefinitionType | FinancialLayoutType

export const typeNameToParser:
Record<string, (definition: string) => Promise<ReportTypes>> = {
  [FINANCIAL_LAYOUT]: parseFinancialLayoutDefinition,
  [REPORT_DEFINITION]: parseReportDefintionDefinition,
  [SAVED_SEARCH]: parseSavedSearchDefinition,
}
const wasModified = async (instance:InstanceElement): Promise<boolean> => {
  const definitionOrLayout = instance.elemID.typeName === FINANCIAL_LAYOUT
    ? instance.value.layout : instance.value.definition
  const parserFunction = typeNameToParser[instance.elemID.typeName]
  const parsedDefinition = await parserFunction(definitionOrLayout)
  return Object.keys(parsedDefinition)
    .some(key => !_.isEqual(parsedDefinition[key as keyof ReportTypes], instance.value[key]))
}

const getChangeError = async (instance: InstanceElement): Promise<ChangeError> => {
  const instanceName = typeToParameters[instance.elemID.typeName].name
  if (await wasModified(instance)) {
    return ({
      elemID: instance.elemID,
      severity: 'Error',
      message: `Modified ${instanceName} cannot be deployed.`,
      detailedMessage: `Changing (${instance.elemID.getFullName()}) is not supported`,
    } as ChangeError)
  }
  return ({
    elemID: instance.elemID,
    severity: 'Warning',
    message: `Beware that ${instanceName} might reference internal ids that are not correct for the current environment. It is recommended that you verify the deployment in NetSuite UI.`,
    detailedMessage: `Instance (${instance.elemID.getFullName()}) should be reviewed in NetSuite UI to make sure internal ids did not mix between environments`,
  } as ChangeError)
}


const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => [SAVED_SEARCH, FINANCIAL_LAYOUT, REPORT_DEFINITION].includes(instance.elemID.typeName))
    .map(getChangeError)
    .toArray()
)

export default changeValidator
