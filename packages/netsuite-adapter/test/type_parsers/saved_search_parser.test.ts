/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
