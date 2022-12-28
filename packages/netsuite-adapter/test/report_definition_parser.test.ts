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

import * as reportDefinitionParser from '../src/report_definition_parsing/report_definition_parser'
import * as testConsts from './report_definitions_consts'

describe('report definition parser test', () => {
  it('should parse a simple report definition', async () => {
    const parsedReport = await reportDefinitionParser.parseDefinition(testConsts.simpleReportDefinition, 'test_script')
    expect(parsedReport).toEqual(testConsts.simpleReportDefinitionResult)
  })

  it('should parse a full report definition', async () => {
    const parsedReport = await reportDefinitionParser.parseDefinition(testConsts.fullReportDefinition, 'test_script')
    expect(parsedReport).toEqual(testConsts.fullReportDefinitionResult)
  })
})
