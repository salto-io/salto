/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { adjustClass } from '../../../../src/definitions/fetch/transforms'

describe('adjust class', () => {
  it('should throw an error if value is not a record', async () => {
    await expect(adjustClass({ value: 'not a record', context: {}, typeName: 'class' })).rejects.toThrow()
  })
  it('should convert site object to site id', async () => {
    const value = {
      a: 'a',
      site: { id: 'site-id', anotherField: 'bla' },
      b: 'b',
    }
    await expect(adjustClass({ value, context: {}, typeName: 'class' })).resolves.toEqual({
      value: {
        a: 'a',
        site: 'site-id',
        b: 'b',
      },
    })
  })
})
