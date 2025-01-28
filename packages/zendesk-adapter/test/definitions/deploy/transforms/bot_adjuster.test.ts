/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { transformBotResponse } from '../../../../src/definitions/deploy/transforms'

describe('bot_adjuster', () => {
  const value = {
    data: {
      innerBotField: [{ enabledLanguages: ['en', 'fr'], b: 2 }],
    },
  }
  it('should add enabledLanguages correctly', async () => {
    const finalValue = await transformBotResponse('innerBotField')({
      value,
      context: {} as definitions.deploy.ChangeAndExtendedContext,
      typeName: 'test',
    })
    expect(finalValue).toEqual({
      value: {
        b: 2,
        enabledLanguages: ['English', 'French'],
      },
    })
  })
  it('should not add enabledLanguages if not present', async () => {
    const finalValue = await transformBotResponse('innerBotField')({
      value: { data: { innerBotField: [{ b: 2 }] } },
      context: {} as definitions.deploy.ChangeAndExtendedContext,
      typeName: 'test',
    })
    expect(finalValue).toEqual({ value: { b: 2 } })
  })
  it('should handle unknown language code', async () => {
    const finalValue = await transformBotResponse('innerBotField')({
      value: { data: { innerBotField: [{ enabledLanguages: ['zz', 'fr'], b: 2 }] } },
      context: {} as definitions.deploy.ChangeAndExtendedContext,
      typeName: 'test',
    })
    expect(finalValue).toEqual({ value: { b: 2, enabledLanguages: ['zz', 'French'] } })
  })
})
