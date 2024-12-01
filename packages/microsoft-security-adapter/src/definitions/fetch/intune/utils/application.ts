/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { definitions } from '@salto-io/adapter-components'
import { validateArray, validatePlainObject } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { APP_IDENTIFIER_FIELD_NAME, APPLICATION_TYPE_NAME, PACKAGE_ID_FIELD_NAME } from '../../../../constants/intune'
import { NAME_ID_FIELD } from '../../shared/defaults'
import { odataType } from '../../../../utils/shared'
import { AdjustFunctionSingle } from '../../shared/types'
import { ExtractScriptParams, extractStaticFileFromBinaryScript } from './script_content'

const log = logger(module)

export const APPLICATION_FIELDS_TO_OMIT: Record<string, { omit: true }> = {
  uploadState: { omit: true },
  publishingState: { omit: true },
  isAssigned: { omit: true },
  isPrivate: { omit: true },
  supportsOemConfig: { omit: true },
  dependentAppCount: { omit: true },
  supersedingAppCount: { omit: true },
  supersededAppCount: { omit: true },
  usedLicenseCount: { omit: true },
  totalLicenseCount: { omit: true },
  appTracks: { omit: true },
}

/* The following parts are shared for the application elemID definition and its path definition */
export const APPLICATION_TYPE_PART: definitions.fetch.FieldIDPart = {
  fieldName: odataType.getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME),
}

// Some app instances have the same name, so we use other identifiers,
// that should be consistent between envs, whenever possible
export const APPLICATION_NAME_PARTS: definitions.fetch.FieldIDPart[] = [
  // Identifier for: androidManagedStoreApp, androidStoreApp, androidForWorkApp
  { fieldName: APP_IDENTIFIER_FIELD_NAME },
  // Identifier for: androidLobApp, managedAndroidLobApp, managedAndroidStoreApp
  { fieldName: PACKAGE_ID_FIELD_NAME, condition: value => !value[APP_IDENTIFIER_FIELD_NAME] },
  {
    fieldName: NAME_ID_FIELD.fieldName,
    condition: value => !value[APP_IDENTIFIER_FIELD_NAME] && !value[PACKAGE_ID_FIELD_NAME],
  },
]

type ScriptsExtractionParams = {
  scriptsRootFieldNames: string[]
} & Pick<ExtractScriptParams, 'validateFunc' | 'toFileName'>

const odataTypeToScriptsExtractionParams: Record<string, ScriptsExtractionParams> = {
  macOSPkgApp: {
    scriptsRootFieldNames: ['preInstallScript', 'postInstallScript'],
    validateFunc: validatePlainObject,
    toFileName: ({ scriptsRootFieldName }) => `${scriptsRootFieldName}.sh`,
  },
  win32LobApp: {
    scriptsRootFieldNames: ['detectionRules', 'requirementRules'],
    validateFunc: validateArray,
    toFileName: ({ scriptsRootFieldName, scriptField }) => {
      // The displayName exists and is required for the requirementRules.
      // For detectionRules, the displayName does not exist, but there can be at most one detection rule with script.
      if (scriptsRootFieldName === 'requirementRules') {
        const { displayName } = scriptField
        const hasPs1Extension = _.isString(displayName) && displayName.endsWith('.ps1')
        return `${scriptsRootFieldName}_${displayName}${hasPs1Extension ? '' : '.ps1'}`
      }
      return `${scriptsRootFieldName}.ps1`
    },
  },
}

/**
 * Adjust function to set script values as static files for different intune application types.
 */
export const setApplicationScriptValueAsStaticFile: AdjustFunctionSingle = async ({ value }) => {
  validatePlainObject(value, APPLICATION_TYPE_NAME)

  const appOdataType = value[odataType.getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]
  if (!_.isString(appOdataType)) {
    log.warn(`Failed to adjust script values for ${APPLICATION_TYPE_NAME} - odataType is not a string`)
    return { value }
  }

  const scriptsExtractionParams = odataTypeToScriptsExtractionParams[appOdataType]
  if (!scriptsExtractionParams) {
    return { value }
  }

  scriptsExtractionParams.scriptsRootFieldNames.forEach(scriptsRootFieldName => {
    extractStaticFileFromBinaryScript({
      value,
      typeName: APPLICATION_TYPE_NAME,
      scriptsRootFieldName,
      staticFileSubDirectory: appOdataType,
      ...scriptsExtractionParams,
    })
  })

  return { value }
}
