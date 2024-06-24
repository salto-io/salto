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

import { parseDefinition } from '../../src/type_parsers/report_definition_parsing/report_definition_parser'
import {
  simpleReportDefinition,
  simpleReportDefinitionResult,
  fullReportDefinition,
  fullReportDefinitionResult,
} from './report_definitions_consts'
import { reportdefinitionType } from '../../src/type_parsers/report_definition_parsing/parsed_report_definition'
import { reportdefinitionType as oldReportDefinitionType } from '../../src/autogen/types/standard_types/reportdefinition'

describe('report definition parser test', () => {
  it('should parse a simple report definition', async () => {
    const parsedReport = await parseDefinition(simpleReportDefinition)
    expect(parsedReport).toEqual(simpleReportDefinitionResult)
  })

  it('should parse a full report definition', async () => {
    const parsedReport = await parseDefinition(fullReportDefinition)
    expect(parsedReport).toEqual(fullReportDefinitionResult)
  })
})

describe('fields and inner fields test', () => {
  const { type: oldType, innerTypes: oldInnerTypes } = oldReportDefinitionType()
  const { type: parsedType, innerTypes: parsedInnerTypes } = reportdefinitionType()
  it('should have the same fields as the auto generated type', async () => {
    Object.keys(oldType.fields).forEach(key => expect(oldType.fields[key].isEqual(parsedType.fields[key])).toBeTruthy())
  })

  it('should have the same inner types as the auto generated type', async () => {
    Object.keys(oldInnerTypes).forEach(innerType =>
      expect(oldInnerTypes[innerType].isEqual(parsedInnerTypes[innerType])).toBeTruthy(),
    )
  })
})
