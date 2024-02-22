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
import * as savedSearchParser from '../../src/type_parsers/saved_search_parsing/saved_search_parser'
import * as testConsts from './saved_search_definition'

describe('saved search parser tests', () => {
  it('test parse empty definition', async () => {
    const parsedDefinition = await savedSearchParser.parseDefinition(testConsts.emptyDefinition)
    expect(parsedDefinition).toEqual(testConsts.emptyDefinitionOutcome)
  })
  it('test parse listed definition', async () => {
    const parsedDefinition = await savedSearchParser.parseDefinition(testConsts.listedDefinition)
    expect(parsedDefinition).toEqual(testConsts.listedDefinitionOutcome)
  })
  it('test parse singles definition', async () => {
    const parsedDefinition = await savedSearchParser.parseDefinition(testConsts.singlesDefinition)
    expect(parsedDefinition).toEqual(testConsts.singlesDefinitionOutcome)
  })
  it('test parse edge case definition', async () => {
    const parsedDefinition = await savedSearchParser.parseDefinition(testConsts.edgeCaseDefinition)
    expect(parsedDefinition).toEqual(testConsts.edgeCaseDefinitionOutcome)
  })
})
