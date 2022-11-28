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
/* eslint-disable no-underscore-dangle */
import { Value, Values } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { ElementCompact } from 'xml-js'
import {
  getSearchDependency,
  getJson,
  ElementParts,
  getFlags,
  extractSearchRecordsValues,
  safeAssignKeyValue,
  RecordObject,
  getObjectFromValues,
  AttributeObject,
} from '../saved_search_parsing/saved_search_parser'

const LAYOUTS = 'layouts'
const PARAMETERS = 'parameters'
const COMPONENTS = 'components'
const SORTS = 'sorts'
const UI_PREFERENCES = 'ui_preferences'
const FIELDS = 'fields'
const CRITERIA = 'criteria'


type InnerParamObject =
{
  _attributes:{
    class?: string
    clazz?: string
    escapeStringIfQuoting?: string
    field?: string
    fieldType?: string
    quoteByNamingConvention?: string
}
  _text: string
}
type ReportCriterionParent = { _attributs: { class:string; reference: string }}
type ReportCriterionDescriptor =
{
 components: InnerParamObject
 field:
 {
   parent: ReportCriterionParent
   recordType: InnerParamObject
   values: { Value: AttributeObject[] }
  }
 parent: ReportCriterionParent
}
type ReportCriterionValues = { _attributs: { class: string }; Record: RecordObject }
type ReportCriterionObject = {
 descriptor: ReportCriterionDescriptor
 parent: ReportCriterionParent
 values: ReportCriterionValues
}
type ReportCriteria =
{
  type: InnerParamObject
  values:
  {
    ReportCriterion: ReportCriterionObject[]
  }
}
type ParameterObject =
{
  key: InnerParamObject
  parent: { class: string; reference: string}
  value: InnerParamObject
}

const getReportDefinition = (search: ElementCompact): ElementCompact =>
  search['nssoc:SerializedObjectContainer']['nssoc:definition'].ReportDefinition

const getReportPartsFromDefinition = async (definition: string): Promise<ElementParts> => {
  const parsedXml = await getJson(definition)
  return { definition: getReportDefinition(parsedXml),
    dependency: getSearchDependency(parsedXml) }
}

const getReportParameters = (reportParameter: { Map: ParameterObject[] }): Values => new Map(
  reportParameter.Map.map(i => [i.key._text, i.value._text])
)

const getReportCriteria = (criteria: ReportCriteria): Values =>
  collections.array.makeArray(criteria.values?.ReportCriterion)
    .map(criterion => {
      const values = extractSearchRecordsValues(criterion)
      const descriptor = getObjectFromValues(criterion.descriptor.field.values.Value)
      return { descriptor, values }
    })

const getUiPreferences = (uiPref: ElementCompact): Values =>
  getObjectFromValues(uiPref.values.Value)

export const parseDefinition = async (definition: string): Promise<Value> => {
  const reportParts = await getReportPartsFromDefinition(definition)
  const returnInstance = {}
  safeAssignKeyValue(returnInstance, LAYOUTS, extractSearchRecordsValues(reportParts.definition.layouts))
  safeAssignKeyValue(returnInstance, COMPONENTS, extractSearchRecordsValues(reportParts.definition.components))
  safeAssignKeyValue(returnInstance, PARAMETERS, getReportParameters(reportParts.definition.parameters.values))
  safeAssignKeyValue(returnInstance, SORTS, extractSearchRecordsValues(reportParts.definition.sorts))
  safeAssignKeyValue(returnInstance, FIELDS, extractSearchRecordsValues(reportParts.definition.fields))
  safeAssignKeyValue(returnInstance, UI_PREFERENCES, getUiPreferences(reportParts.definition.uiPreferences))
  safeAssignKeyValue(returnInstance, CRITERIA, getReportCriteria(reportParts.definition.criteria))
  Object.assign(returnInstance, getFlags(reportParts.definition))
  return returnInstance
}
