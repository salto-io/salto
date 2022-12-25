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
import _ from 'lodash'
import { ElementCompact } from 'xml-js'
import {
  getElementDependency,
  getJson,
  ElementParts,
  getFlags,
  extractRecordsValues,
  RecordObject,
  getObjectFromValues,
  AttributeObject,
} from '../report_types_parser_utils'
import { ReportDefinitionType, ReportUiPrefType } from './parsed_report_definition'

type InnerParamObject = {
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
type ReportCriterionDescriptor = {
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
type ReportCriteria = {
  type: InnerParamObject
  values: {
    ReportCriterion: ReportCriterionObject[]
  }
}
type ParameterObject = {
  key: InnerParamObject
  parent: { class: string; reference: string}
  value: InnerParamObject
}

const getReportDefinition = (search: ElementCompact): ElementCompact =>
  search['nssoc:SerializedObjectContainer']['nssoc:definition'].ReportDefinition

const getReportPartsFromDefinition = async (definition: string): Promise<ElementParts> => {
  const parsedXml = await getJson(definition)
  return {
    definition: getReportDefinition(parsedXml),
    dependency: getElementDependency(parsedXml),
  }
}

const getReportParameters = (reportParameter: { Map: ParameterObject[] }): Values => {
  const paramObject: Record<string, Value> = {}
  paramObject.Map = Object.fromEntries(reportParameter.Map.map(i => [i.key._text, i.value._text]))
  return paramObject
}

const getReportCriteria = (criteria: ReportCriteria): Values[] =>
  collections.array.makeArray(criteria.values?.ReportCriterion)
    .map(criterion => {
      const values = extractRecordsValues(criterion)
      const descriptor = getObjectFromValues(criterion.descriptor.field.values.Value)
      return { descriptor, values }
    })

const getUiPreferences = (uiPref: ElementCompact): ReportUiPrefType =>
  getObjectFromValues(uiPref.values.Value)

export const parseDefinition = async (definition: string): Promise<ReportDefinitionType> => {
  const reportParts = await getReportPartsFromDefinition(definition)
  const returnInstance: ReportDefinitionType = {
    layouts: extractRecordsValues(reportParts.definition.layouts),
    components: extractRecordsValues(reportParts.definition.components),
    parameters: getReportParameters(reportParts.definition.parameters.values),
    sorts: extractRecordsValues(reportParts.definition.sorts),
    fields: extractRecordsValues(reportParts.definition.fields),
    uiPreferences: getUiPreferences(reportParts.definition.uiPreferences),
    criteria: getReportCriteria(reportParts.definition.criteria),
    innerFields: getFlags(reportParts.definition),
  }
  Object.keys(returnInstance).forEach(key => {
    if (_.isEmpty(returnInstance[key as keyof ReportDefinitionType])) {
      delete returnInstance[key as keyof ReportDefinitionType]
    }
  })
  return returnInstance
}
