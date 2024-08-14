/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
