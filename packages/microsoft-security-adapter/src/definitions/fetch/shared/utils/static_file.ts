/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { StaticFile } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { ADAPTER_NAME } from '../../../../constants'

/**
 * Creates a static file from a base64 blob, using the element's full name as the folder name for uniqueness
 */
export const createStaticFileFromBase64Blob = ({
  typeName,
  fullName,
  fileName,
  content,
}: {
  typeName: string
  fullName: string
  fileName: string
  content: string
}): StaticFile => {
  const formattedFullName = naclCase(fullName).replace('@', '.')

  return new StaticFile({
    filepath: `${ADAPTER_NAME}/${typeName}/${formattedFullName}/${fileName}`,
    content: Buffer.from(content, 'base64'),
    encoding: 'base64',
  })
}
