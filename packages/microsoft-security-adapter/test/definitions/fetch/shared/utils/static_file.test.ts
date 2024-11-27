/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { StaticFile } from '@salto-io/adapter-api'
import { createStaticFileFromBase64Blob } from '../../../../../src/definitions/fetch/shared/utils'

describe('static file utils', () => {
  describe(`${createStaticFileFromBase64Blob.name}`, () => {
    it('should create a static file with the correct content', async () => {
      const staticFile = createStaticFileFromBase64Blob({
        typeName: 'testType',
        fullName: 'test Full Name',
        fileName: 'testFileName',
        content: 'PG5vdGU+VGhpcyBpcyBhIHRlc3Q8L25vdGU+',
      })
      expect(staticFile).toBeInstanceOf(StaticFile)
      expect(staticFile.filepath).toBe('microsoft_security/testType/test_Full_Name.s/testFileName')
      expect(staticFile.encoding).toBe('base64')
      const content = await staticFile.getContent()
      expect(content).toBeInstanceOf(Buffer)
      expect(content?.toString()).toBe('<note>This is a test</note>')
    })
  })
})
