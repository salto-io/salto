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

export type ValidateScriptsRootFieldFunc = (scriptRootFieldValue: unknown, path: string) => void
export type ToFileNameFunc = (metadata: { scriptsRootFieldName: string; scriptField: Values; index: number }) => string

export type ExtractScriptParams = {
  value: Values
  typeName: string
  scriptsRootFieldName: string
  scriptValuePath?: string[]
  elemIDFieldName?: string
  staticFileSubDirectory?: string
  throwOnEmptyField?: boolean
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
  throwOnEmptyField = false,
  validateFunc,
  toFileName,
}: ExtractScriptParams): void => {
  const scriptsField = _.get(value, scriptsRootFieldName)
  if (_.isEmpty(scriptsField)) {
    if (throwOnEmptyField) {
      const message = `Expected to find ${typeName}.${scriptsRootFieldName} but got ${safeJsonStringify(scriptsField)}`
      log.error(message)
      throw new Error(message)
    }
    return
  }

  validateFunc(scriptsField, `${typeName}.${scriptsRootFieldName}`)
  const scripts = array.makeArray(scriptsField)

  scripts.forEach((scriptField, index) => {
    const path = `${typeName}.${scriptsRootFieldName}${scripts.length > 1 ? `[${index}]` : ''}`
    validatePlainObject(scriptField, path)

    const scriptContent = _.get(scriptField, scriptValuePath)
    if (scriptContent === undefined) {
      log.debug(`No script content found for ${typeName}.${scriptsRootFieldName} (ID: ${value.id})`)
      return
    }

    if (!_.isString(scriptContent)) {
      const message = `Invalid script content for ${typeName}.${scriptsRootFieldName}. Expected string, got ${safeJsonStringify(scriptContent)}`
      log.error(message)
      throw new Error(message)
    }

    _.set(
      scriptField,
      scriptValuePath,
      createStaticFileFromBase64Blob({
        typeName,
        // SALTO-6935: handle custom elemIds
        fullName: value[elemIDFieldName],
        fileName: toFileName({ scriptsRootFieldName, scriptField, index }),
        content: scriptContent,
        subDirectory: staticFileSubDirectory,
      }),
    )
  })
}
