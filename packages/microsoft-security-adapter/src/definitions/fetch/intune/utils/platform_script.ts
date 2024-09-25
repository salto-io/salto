/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { validateArray, validatePlainObject } from '@salto-io/adapter-utils'
import { fetch as fetchUtils } from '@salto-io/adapter-components'
import { DEFAULT_TRANSFORMATION, ID_FIELD_TO_HIDE, NAME_ID_FIELD } from '../../shared/defaults'
import { AdjustFunctionMergeAndTransform, FetchCustomizations } from '../../shared/types'
import { intuneConstants } from '../../../../constants'
import { EndpointPath } from '../../../types'
import { SERVICE_BASE_URL } from '../../../../constants/intune'
import { ASSIGNMENT_FIELD_CUSTOMIZATION } from './group_assignments'
import { createStaticFileFromBase64Blob } from '../../shared/utils'

const log = logger(module)
const { recursiveNestedTypeName } = fetchUtils.element

const {
  PLATFORM_SCRIPT_LINUX_TYPE_NAME,
  PLATFORM_SCRIPT_LINUX_SETTINGS_TYPE_NAME,
  SCRIPT_VALUE_FIELD_NAME,
  SCRIPT_CONTENT_FIELD_NAME,
  SCRIPT_CONTENT_RECURSE_INTO_FIELD_NAME,
  SETTING_DEFINITION_ID_FIELD_NAME,
  SETTING_INSTANCE_FIELD_NAME,
  SETTINGS_FIELD_NAME,
  SIMPLE_SETTING_VALUE_FIELD_NAME,
  ASSIGNMENTS_ODATA_CONTEXT,
  ASSIGNMENTS_FIELD_NAME,
} = intuneConstants

/**
 * Creates a static file from the binary content of each setting that has a script value in the given instance.
 */
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
      createStaticFileFromBase64Blob({
        typeName: PLATFORM_SCRIPT_LINUX_TYPE_NAME,
        fullName: value.name,
        fileName: `${_.get(setting, [SETTING_INSTANCE_FIELD_NAME, SETTING_DEFINITION_ID_FIELD_NAME])}.sh`,
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

/**
 * Creates a static file from the binary content of the field scriptContent in the given script instance.
 * The script instance is either Windows or MacOS.
 */
export const setScriptValueAsStaticFile: AdjustFunctionMergeAndTransform = async ({ value, typeName }) => {
  validatePlainObject(value, typeName)
  const scriptContent = _.get(value, SCRIPT_CONTENT_RECURSE_INTO_FIELD_NAME)
  validateArray(scriptContent, `${typeName}.${SCRIPT_CONTENT_FIELD_NAME}`)
  if (scriptContent.length !== 1) {
    log.error(
      `Expected exactly one script content for script ${value[NAME_ID_FIELD.fieldName]}: ${value.id}. Found ${scriptContent.length}`,
    )
    throw new Error(`Expected exactly one script content for script ${value[NAME_ID_FIELD.fieldName]}: ${value.id}`)
  }

  return {
    value: {
      ..._.omit(value, SCRIPT_CONTENT_RECURSE_INTO_FIELD_NAME),
      [SCRIPT_CONTENT_FIELD_NAME]: createStaticFileFromBase64Blob({
        typeName,
        fullName: value[NAME_ID_FIELD.fieldName],
        fileName: value.fileName,
        content: _.get(scriptContent[0], SCRIPT_CONTENT_FIELD_NAME),
      }),
    },
  }
}
/**
 * Creates a fetch definition for fetching macOS or windows platform scripts.
 * Includes fetching the script content separately for each script, and transforming it into a static file.
 */
export const createPlatformScriptFetchDefinition = ({
  typeName,
  path,
  platform,
}: {
  typeName: string
  path: EndpointPath
  platform: 'Windows' | 'MacOS'
}): FetchCustomizations => ({
  [typeName]: {
    requests: [
      {
        endpoint: {
          path,
          queryArgs: {
            $expand: 'assignments',
          },
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: [ASSIGNMENTS_ODATA_CONTEXT],
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        // Additional request to get script's content - for some reason it's returned as null in the main request
        [SCRIPT_CONTENT_RECURSE_INTO_FIELD_NAME]: {
          typeName: recursiveNestedTypeName(typeName, SCRIPT_CONTENT_RECURSE_INTO_FIELD_NAME),
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
        },
      },
      mergeAndTransform: {
        adjust: setScriptValueAsStaticFile,
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: {
          baseUrl: SERVICE_BASE_URL,
          path: `/#view/Microsoft_Intune_DeviceSettings/ConfigureWMPolicyMenuBlade/~/properties/policyId/{id}/policyType~/${platform === 'Windows' ? 0 : 1}`,
        },
        allowEmptyArrays: true,
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        [ASSIGNMENTS_FIELD_NAME]: ASSIGNMENT_FIELD_CUSTOMIZATION,
      },
    },
  },
  [recursiveNestedTypeName(typeName, SCRIPT_CONTENT_RECURSE_INTO_FIELD_NAME)]: {
    requests: [
      {
        endpoint: {
          path: `${path}/{id}`,
          queryArgs: {
            $select: SCRIPT_CONTENT_FIELD_NAME,
          },
        },
      },
    ],
    resource: {
      directFetch: false,
    },
  },
})
