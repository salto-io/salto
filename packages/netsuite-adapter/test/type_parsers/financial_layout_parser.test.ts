/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { layoutDefinition, layoutDefinitionResult } from './financial_layout_consts'
import { parseDefinition } from '../../src/type_parsers/financial_layout_parsing/financial_layout_parser'
import { financiallayoutType as oldFinancialLayout } from '../../src/autogen/types/standard_types/financiallayout'
import { financiallayoutType } from '../../src/type_parsers/financial_layout_parsing/parsed_financial_layout'

describe('financial layout parser tests', () => {
  it('should parse financial layout', async () => {
    const parsedLayout = await parseDefinition(layoutDefinition)
    expect(parsedLayout).toEqual(layoutDefinitionResult)
  })
})

describe('fields and inner types test', () => {
  const { type: oldType, innerTypes: oldInnerTypes } = oldFinancialLayout()
  const { type: parsedType, innerTypes: parsedInnerTypes } = financiallayoutType()

  it('should have same fields as auto generated type', async () => {
    Object.keys(oldType.fields).forEach(key => expect(oldType.fields[key].isEqual(parsedType.fields[key])).toBeTruthy())
  })

  it('should have the same inner types as auto generated type', async () => {
    Object.keys(oldInnerTypes).forEach(innerType =>
      expect(oldInnerTypes[innerType].isEqual(parsedInnerTypes[innerType])).toBeTruthy(),
    )
  })
})
