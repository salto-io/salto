/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { StaticFile } from '@salto-io/adapter-api'

export const validateStaticFile = async ({
  value,
  expectedPath,
  expectedContent,
  encoding = 'base64',
}: {
  value: unknown
  expectedContent: string
  expectedPath: string
  encoding?: BufferEncoding
}): Promise<void> => {
  expect(value).toBeInstanceOf(StaticFile)
  const staticFile = value as StaticFile
  expect(staticFile.filepath).toEqual(expectedPath)
  expect(staticFile.encoding).toEqual(encoding)
  const content = await staticFile.getContent()
  expect(content).toBeInstanceOf(Buffer)
  expect(content?.toString()).toEqual(expectedContent)
}
