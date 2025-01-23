/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { getFullLanguageName } from '../../../src/definitions/shared/transforms/bot_adjuster'

describe('getFullLanguageName', () => {
  it('should return the full language name', () => {
    expect(getFullLanguageName('en')).toEqual('English')
  })

  it('should return the language code if the language is not found', () => {
    expect(getFullLanguageName('zz')).toEqual('zz')
  })
})
