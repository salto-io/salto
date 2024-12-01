/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Values } from '@salto-io/adapter-api'
import { safeJsonStringify, validatePlainObject } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { createStaticFileFromBase64Blob } from '../../shared/utils'
import { SCRIPT_CONTENT_FIELD_NAME } from '../../../../constants/intune'
import { NAME_ID_FIELD } from '../../shared/defaults'

const { array } = collections
const log = logger(module)

type ValidateScriptsRootFieldFunc = (scriptRootFieldValue: unknown, path: string) => void
type ToFileNameFunc = (metadata: { scriptsRootFieldName: string; scriptField: Values }) => string

export type ExtractScriptParams = {
  value: Values
  typeName: string
  scriptsRootFieldName: string
  scriptValuePath?: string[]
  elemIDFieldName?: string
  staticFileSubDirectory?: string
  validateFunc: ValidateScriptsRootFieldFunc
  toFileName: ToFileNameFunc
}

export const extractStaticFileFromBinaryScript = ({
  value,
  typeName,
  scriptsRootFieldName,
  scriptValuePath = [SCRIPT_CONTENT_FIELD_NAME],
  elemIDFieldName = NAME_ID_FIELD.fieldName,
  staticFileSubDirectory = '',
  validateFunc,
  toFileName,
}: ExtractScriptParams): { value: Values } => {
  const scriptsField = _.get(value, scriptsRootFieldName)
  if (_.isEmpty(scriptsField)) {
    log.debug(`No scripts found in ${typeName}.${scriptsRootFieldName}. Skipping`)
    return { value }
  }

  validateFunc(scriptsField, `${typeName}.${scriptsRootFieldName}`)
  const scripts = array.makeArray(scriptsField)

  scripts.forEach((scriptField, index) => {
    const path = `${typeName}.${scriptsRootFieldName}${scripts.length > 1 ? `[${index}]` : ''}`
    validatePlainObject(scriptField, path)

    const scriptContent = _.get(scriptField, scriptValuePath)
    if (!_.isString(scriptContent)) {
      log.trace(
        `Received non-string script content for ${path}.${scriptValuePath.join('.')}: ${safeJsonStringify(scriptContent)}. Skipping`,
      )
      return
    }

    _.set(
      scriptField,
      scriptValuePath,
      createStaticFileFromBase64Blob({
        typeName,
        // SALTO-6935: handle custom elemIds
        fullName: value[elemIDFieldName],
        fileName: toFileName({ scriptsRootFieldName, scriptField }),
        content: scriptContent,
        subDirectory: staticFileSubDirectory,
      }),
    )
  })

  return { value }
}
