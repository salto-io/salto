/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { StaticFile } from '@salto-io/adapter-api'
import { fileNameFromUniqueName } from '@salto-io/adapter-utils'
import { MICROSOFT_SECURITY } from '../../../../constants'

const toSafeFileName = (fileName: string): string => {
  const fileNameParts = fileName.split('.')
  if (fileNameParts.length === 1) {
    return fileNameFromUniqueName(fileName)
  }
  const fileNameExtension = fileNameParts.pop()
  const safeFileName = fileNameFromUniqueName(fileNameParts.join('.'))
  return `${safeFileName}.${fileNameExtension}`
}

/**
 * Creates a static file from a base64 blob, using the element's full name as the folder name for uniqueness
 */
export const createStaticFileFromBase64Blob = ({
  typeName,
  fullName,
  fileName,
  content,
  subDirectory = '',
}: {
  typeName: string
  fullName: string
  fileName: string
  content: string
  subDirectory?: string
}): StaticFile => {
  const formattedParentDir = fileNameFromUniqueName(fullName)
  const safeFileName = toSafeFileName(fileName)

  return new StaticFile({
    filepath: `${MICROSOFT_SECURITY}/${typeName}/${subDirectory}/${formattedParentDir}/${safeFileName}`,
    content: Buffer.from(content, 'base64'),
    encoding: 'base64',
  })
}
