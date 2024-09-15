/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { naclCase, validateArray, validatePlainObject } from '@salto-io/adapter-utils'
import { StaticFile } from '@salto-io/adapter-api'
import { NAME_ID_FIELD } from '../../shared/defaults'
import { AdjustFunctionMergeAndTransform } from '../../shared/types'
import { ADAPTER_NAME, intuneConstants } from '../../../../constants'
import { EndpointPath as FilePath } from '../../../types'

const {
  PLATFORM_SCRIPT_LINUX_TYPE_NAME,
  PLATFORM_SCRIPT_WINDOWS_TYPE_NAME,
  PLATFORM_SCRIPT_LINUX_SETTINGS_TYPE_NAME,
  SCRIPT_VALUE_FIELD_NAME,
  SCRIPT_CONTENT_FIELD_NAME,
  SCRIPT_CONTENT_RECURSE_INTO_FIELD_NAME,
  SETTING_DEFINITION_ID_FIELD_NAME,
  SETTING_INSTANCE_FIELD_NAME,
  SETTINGS_FIELD_NAME,
  SIMPLE_SETTING_VALUE_FIELD_NAME,
} = intuneConstants

const createStaticFileFromScript = ({
  typeName,
  uniquePath,
  fileExtension,
  content,
}: {
  typeName: string
  uniquePath: FilePath
  fileExtension: 'sh' | 'ps1'
  content: string
}): StaticFile => {
  const formattedUniquePath = uniquePath
    .split('/')
    .map(naclCase)
    .map(name => name.replace('@', '-'))
    .join('/')

  return new StaticFile({
    filepath: `${ADAPTER_NAME}/${typeName}/${formattedUniquePath}.${fileExtension}`,
    content: Buffer.from(content, 'base64'),
    encoding: 'base64',
  })
}

export const setLinuxScriptValueAsStaticFile: AdjustFunctionMergeAndTransform = async ({ value }) => {
  validatePlainObject(value, PLATFORM_SCRIPT_LINUX_TYPE_NAME)

  const settings = value[SETTINGS_FIELD_NAME]
  if (!settings) {
    return { value }
  }
  validateArray(settings, PLATFORM_SCRIPT_LINUX_SETTINGS_TYPE_NAME)

  const mappedSettings = settings.map(setting => {
    validatePlainObject(setting, PLATFORM_SCRIPT_LINUX_SETTINGS_TYPE_NAME)
    const fileContent = _.get(setting, [
      SETTING_INSTANCE_FIELD_NAME,
      SIMPLE_SETTING_VALUE_FIELD_NAME,
      SCRIPT_VALUE_FIELD_NAME,
    ])
    // Not all settings have a script value
    if (!fileContent) {
      return setting
    }
    _.set(
      setting,
      [SETTING_INSTANCE_FIELD_NAME, SIMPLE_SETTING_VALUE_FIELD_NAME, SCRIPT_VALUE_FIELD_NAME],
      createStaticFileFromScript({
        typeName: PLATFORM_SCRIPT_LINUX_TYPE_NAME,
        uniquePath: `/${value.name}/${_.get(setting, [SETTING_INSTANCE_FIELD_NAME, SETTING_DEFINITION_ID_FIELD_NAME])}`,
        fileExtension: 'sh',
        content: fileContent,
      }),
    )
    return setting
  })

  return {
    value: {
      ...value,
      [SETTINGS_FIELD_NAME]: mappedSettings,
    },
  }
}

export const setWindowsScriptValueAsStaticFile: AdjustFunctionMergeAndTransform = async ({ value }) => {
  validatePlainObject(value, PLATFORM_SCRIPT_WINDOWS_TYPE_NAME)
  const scriptContent = _.get(value, SCRIPT_CONTENT_RECURSE_INTO_FIELD_NAME)
  validateArray(scriptContent, `${PLATFORM_SCRIPT_WINDOWS_TYPE_NAME}.${SCRIPT_CONTENT_FIELD_NAME}`)
  if (scriptContent.length !== 1) {
    throw new Error(`Expected exactly one script content for script ${value[NAME_ID_FIELD.fieldName]}`)
  }

  return {
    value: {
      ..._.omit(value, SCRIPT_CONTENT_RECURSE_INTO_FIELD_NAME),
      [SCRIPT_CONTENT_FIELD_NAME]: createStaticFileFromScript({
        typeName: PLATFORM_SCRIPT_WINDOWS_TYPE_NAME,
        uniquePath: value[NAME_ID_FIELD.fieldName],
        fileExtension: 'ps1',
        content: _.get(scriptContent[0], SCRIPT_CONTENT_FIELD_NAME),
      }),
    },
  }
}
