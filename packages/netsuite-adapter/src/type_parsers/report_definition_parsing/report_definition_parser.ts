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
import { Values } from '@salto-io/adapter-api'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import _ from 'lodash'
import { ElementCompact } from 'xml-js'
import { REPORT_DEFINITION } from '../../constants'
import {
  getJson,
  getFlags,
  extractRecordsValues,
  RecordObject,
  getObjectFromValues,
  AttributeObject,
  getDefinitionOrLayout,
} from '../report_types_parser_utils'
import {
  ReportUiPrefType,
  ReportCriteriaType,
  ParsedReportDefinition,
  ReportParameters,
} from './parsed_report_definition'

type ReportCriterionParent = {
  _attributs?: {
    class?: string
    reference?: string
  }
}
type ReportCriterionDescriptor = {
  components?: Values
  field?: {
    parent?: ReportCriterionParent
    values?: {
      Value?: AttributeObject[]
    }
  }
  parent?: ReportCriterionParent
}
type ReportCriterionValues = {
  _attributs?: {
    class?: string
  }
  Record?: RecordObject
}
type ReportCriterionObject = {
  descriptor?: ReportCriterionDescriptor
  parent?: ReportCriterionParent
  values?: ReportCriterionValues
}
type ReportCriteria = {
  type?: Values
  values?: {
    ReportCriterion?: ReportCriterionObject[]
  }
}
type ParameterObject = {
  key?: Values
  parent?: {
    class?: string
    reference?: string
  }
  value?: Values
}

const getReportPartsFromDefinition = async (definition: string): Promise<ElementCompact | undefined> => {
  const parsedXml = await getJson(definition)
  return getDefinitionOrLayout(parsedXml, REPORT_DEFINITION)
}

const getReportParameters = (reportParameter: { Map?: ParameterObject[] } | undefined): ReportParameters =>
  Object.fromEntries(
    collections.array
      .makeArray(reportParameter?.Map)
      .map(i => {
        if (i.key === undefined || i.value === undefined) {
          return undefined
        }
        // eslint-disable-next-line no-underscore-dangle
        return [i.key._text, i.value._text]
      })
      .filter(lowerdashValues.isDefined),
  )

const shouldOmitDates = ({ descriptor, values }: ReportCriteriaType): boolean =>
  descriptor?.FILED_TYPE === 'DATE' &&
  values?.length === 3 &&
  values[0].FIELD_VALUE !== undefined &&
  values[0].FIELD_VALUE !== 'CUSTOM'

const getReportCriteria = (criteria: ReportCriteria | undefined): ReportCriteriaType[] =>
  collections.array.makeArray(criteria?.values?.ReportCriterion).map(criterion => {
    const values = extractRecordsValues(criterion)
    const descriptor = getObjectFromValues(criterion.descriptor?.field?.values?.Value)
    return _.omitBy(
      {
        descriptor,
        values: shouldOmitDates({ descriptor, values }) ? values.slice(0, 1) : values,
      },
      _.isEmpty,
    )
  })

const getUiPreferences = (uiPref: ElementCompact | undefined): ReportUiPrefType =>
  getObjectFromValues(uiPref?.values?.Value)

export const parseDefinition = async (definition: string): Promise<ParsedReportDefinition> => {
  const reportDefinition = await getReportPartsFromDefinition(definition)
  return _.omitBy(
    {
      layouts: extractRecordsValues(reportDefinition?.layouts),
      components: extractRecordsValues(reportDefinition?.components),
      parameters: getReportParameters(reportDefinition?.parameters?.values),
      sorts: extractRecordsValues(reportDefinition?.sorts),
      fields: extractRecordsValues(reportDefinition?.fields),
      uiPreferences: getUiPreferences(reportDefinition?.uiPreferences),
      criteria: getReportCriteria(reportDefinition?.criteria),
      flags: getFlags(reportDefinition),
    },
    _.isEmpty,
  )
}
