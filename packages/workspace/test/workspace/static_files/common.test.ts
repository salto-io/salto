/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  isInvalidStaticFile,
  MissingStaticFile,
  AccessDeniedStaticFile,
} from '../../../src/workspace/static_files/common'

describe('Static Files Common', () => {
  it('isInvalidStaticFile for MissingStaticFile', () =>
    expect(isInvalidStaticFile(new MissingStaticFile('aaa'))).toBeTruthy())
  it('isInvalidStaticFile for AccessDeniedStaticFile', () =>
    expect(isInvalidStaticFile(new AccessDeniedStaticFile('aaa'))).toBeTruthy())
  it('isInvalidStaticFile for not InvalidStaticFile', () => expect(isInvalidStaticFile('ZOMG')).toBeFalsy())
})
