/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { transformBotItem } from '../../../../src/definitions/fetch/transforms'

describe('bot_adjuster', () => {
  const value = {
    data: {
      flows: [{ enabledLanguages: ['en', 'fr'], b: 2 }],
    },
  }
  it('should add enabledLanguages correctly', async () => {
    const finalValue = await transformBotItem({ value, context: {}, typeName: 'test' })
    expect(finalValue).toEqual([
      {
        value: {
          b: 2,
          enabledLanguages: ['English', 'French'],
        },
      },
    ])
  })
  it('should not add enabledLanguages if not present', async () => {
    const finalValue = await transformBotItem({ value: { data: { flows: [{ b: 2 }] } }, context: {}, typeName: 'test' })
    expect(finalValue).toEqual([{ value: { b: 2 } }])
  })
  it('should handle unknown language code', async () => {
    const finalValue = await transformBotItem({
      value: { data: { flows: [{ enabledLanguages: ['zz', 'fr'], b: 2 }] } },
      context: {},
      typeName: 'test',
    })
    expect(finalValue).toEqual([{ value: { b: 2, enabledLanguages: ['zz', 'French'] } }])
  })
})
