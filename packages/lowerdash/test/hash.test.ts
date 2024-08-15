/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { toMD5 } from '../src/hash'

describe('Hash', () => {
  it('should calculate MD5 from buffer', () =>
    expect(toMD5(Buffer.from('ZOMG'))).toEqual('4dc55a74daa147a028360ee5687389d7'))
})
