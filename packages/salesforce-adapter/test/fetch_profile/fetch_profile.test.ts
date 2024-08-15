/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { validateFetchParameters } from '../../src/fetch_profile/fetch_profile'

describe('Fetch Profile', () => {
  describe('validateFetchParameters', () => {
    describe('when additional important values contain duplicate definitions', () => {
      it('should throw an error', () => {
        const params = {
          additionalImportantValues: [
            { value: 'fullName', highlighted: true, indexed: false },
            { value: 'fullName', highlighted: true, indexed: true },
          ],
        }
        expect(() => validateFetchParameters(params, [])).toThrow()
      })
    })
    describe('when additional important values are valid', () => {
      it('should not throw an error', () => {
        const params = {
          additionalImportantValues: [
            { value: 'fullName', highlighted: true, indexed: false },
            { value: 'label', highlighted: true, indexed: true },
          ],
        }
        expect(() => validateFetchParameters(params, [])).not.toThrow()
      })
    })
  })
})
