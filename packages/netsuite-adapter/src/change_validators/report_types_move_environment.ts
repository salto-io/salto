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
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import {
  getChangeData,
  InstanceElement,
  isInstanceChange,
  ChangeError,
  isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FINANCIAL_LAYOUT, REPORT_DEFINITION, SAVED_SEARCH } from '../constants'
import { parseDefinition as parseSavedSearchDefinition } from '../type_parsers/saved_search_parsing/saved_search_parser'
import { parseDefinition as parseReportDefintionDefinition } from '../type_parsers/report_definition_parsing/report_definition_parser'
import { parseDefinition as parseFinancialLayoutDefinition } from '../type_parsers/financial_layout_parsing/financial_layout_parser'
import { ParsedReportDefinition } from '../type_parsers/report_definition_parsing/parsed_report_definition'
import { ParsedFinancialLayout } from '../type_parsers/financial_layout_parsing/parsed_financial_layout'
import { ParsedSavedSearchType } from '../type_parsers/saved_search_parsing/parsed_saved_search'
import { NetsuiteChangeValidator } from './types'

const log = logger(module)
const { awu } = collections.asynciterable

export type ReportTypes = ParsedSavedSearchType | ParsedReportDefinition | ParsedFinancialLayout

export const mapTypeToLayoutOrDefinition: Record<string, string> = {
  [FINANCIAL_LAYOUT]: 'layout',
  [REPORT_DEFINITION]: 'definition',
  [SAVED_SEARCH]: 'definition',
}

export const typeNameToParser: Record<string, (definition: string) => Promise<ReportTypes>> = {
  [FINANCIAL_LAYOUT]: parseFinancialLayoutDefinition,
  [REPORT_DEFINITION]: parseReportDefintionDefinition,
  [SAVED_SEARCH]: parseSavedSearchDefinition,
}

const typeNameToName: Record<string, string> = {
  [FINANCIAL_LAYOUT]: 'Financial Layout',
  [REPORT_DEFINITION]: 'Report Definition',
  [SAVED_SEARCH]: 'Saved Search',
}

const typeNameToPluralName: Record<string, string> = {
  [FINANCIAL_LAYOUT]: 'Financial Layouts',
  [REPORT_DEFINITION]: 'Report Definitions',
  [SAVED_SEARCH]: 'Saved Searches',
}

const wasModified = async (instance: InstanceElement): Promise<boolean> => {
  const definitionOrLayout = instance.value[mapTypeToLayoutOrDefinition[instance.elemID.typeName]]
  const parserFunction = typeNameToParser[instance.elemID.typeName]
  const parsedDefinition = await parserFunction(definitionOrLayout)
  const existingValues = _.pick(instance.value, Object.keys(parsedDefinition))
  if (!_.isEqual(parsedDefinition, existingValues)) {
    log.debug("existing values don't match parsed definition in %s: %o", instance.elemID.getFullName(), {
      parsedDefinition: safeJsonStringify(parsedDefinition),
      existingValues: safeJsonStringify(existingValues),
    })
    return true
  }
  return false
}

const getChangeError = async (instance: InstanceElement): Promise<ChangeError> => {
  if (await wasModified(instance)) {
    return {
      elemID: instance.elemID,
      severity: 'Error',
      message: "Can't deploy partial changes",
      detailedMessage: `Can't deploy partial changes to this ${typeNameToName[instance.elemID.typeName]} element. Modify it from NetSuite UI, and select the whole element for deployment.`,
    } as ChangeError
  }
  return {
    elemID: instance.elemID,
    severity: 'Warning',
    message: `${typeNameToPluralName[instance.elemID.typeName]} might reference internal IDs that are specific to their source NetSuite account. It is recommended to review the deployment in the target NetSuite account.`,
    detailedMessage: `This ${typeNameToName[instance.elemID.typeName]} might reference internal IDs that are specific to their source NetSuite account. It is recommended to review the referenced internal IDs in the target NetSuite account, in NetSuite's UI, after the deployment succeeds.`,
  } as ChangeError
}

const changeValidator: NetsuiteChangeValidator = async changes =>
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => [SAVED_SEARCH, FINANCIAL_LAYOUT, REPORT_DEFINITION].includes(instance.elemID.typeName))
    .map(getChangeError)
    .toArray()

export default changeValidator
