/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { validateArray, validatePlainObject } from '@salto-io/adapter-utils'
import { StaticFile } from '@salto-io/adapter-api'
import { DEFAULT_TRANSFORMATION } from '../../shared/defaults'
import { AdjustFunctionMergeAndTransform, FetchApiDefinition } from '../../shared/types'
import { ADAPTER_NAME, intuneConstants } from '../../../../constants'

const {
  PLATFORM_SCRIPT_LINUX_TYPE_NAME,
  PLATFORM_SCRIPT_SETTINGS_TYPE_NAME,
  SCRIPT_VALUE_FIELD_NAME,
  SETTING_DEFINITION_ID_FIELD_NAME,
  SETTING_INSTANCE_FIELD_NAME,
  SETTINGS_FIELD_NAME,
  SIMPLE_SETTING_VALUE_FIELD_NAME,
} = intuneConstants

// In the UI, some of the device configurations (setting catalog) are located in the Device Configuration settings tab
// and some are located in the Platform Scripts tab. We align with the UI view by separating them to two different types.
export const DEVICE_CONFIGURATION_SETTINGS_FETCH_DEFINITION: FetchApiDefinition = {
  resource: {
    directFetch: false,
  },
  requests: [
    {
      endpoint: {
        path: '/deviceManagement/configurationPolicies/{id}/settings',
      },
      transformation: DEFAULT_TRANSFORMATION,
    },
  ],
  element: {
    fieldCustomizations: {
      id: {
        omit: true,
      },
    },
  },
}

export const setScriptValueAsStaticFile: AdjustFunctionMergeAndTransform = async ({ value }) => {
  validatePlainObject(value, PLATFORM_SCRIPT_LINUX_TYPE_NAME)

  const settings = value[SETTINGS_FIELD_NAME]
  if (!settings) {
    return { value }
  }
  validateArray(settings, PLATFORM_SCRIPT_SETTINGS_TYPE_NAME)

  const mappedSettings = settings.map(setting => {
    validatePlainObject(setting, PLATFORM_SCRIPT_SETTINGS_TYPE_NAME)
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
      new StaticFile({
        filepath: `${ADAPTER_NAME}/${PLATFORM_SCRIPT_LINUX_TYPE_NAME}/${value.name}/${_.get(setting, [SETTING_INSTANCE_FIELD_NAME, SETTING_DEFINITION_ID_FIELD_NAME])}.sh`,
        content: Buffer.from(fileContent, 'base64'),
        encoding: 'base64',
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
