/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceElement,
  InstanceElement,
} from '@salto-io/adapter-api'
import Joi from 'joi'
import { createSchemeGuardForInstance, getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { APP_INSTALLATION_TYPE_NAME, APP_OWNED_TYPE_NAME } from '../constants'

type AppOwnedParameter = {
  required: boolean
}

type AppOwned = InstanceElement & {
  value: {
    id: number
    parameters?: {
      [key: string]: AppOwnedParameter
    }
  }
}

type AppInstallation = InstanceElement & {
  value: {
    app_id: number
    settings?: {
      [key: string]: unknown
    }
  }
}

const EXPECTED_APP_INSTALLATION_SCHEMA = Joi.object({
  app_id: Joi.number().required(),
  settings: Joi.object().unknown(true),
})
  .unknown(true)
  .required()

const EXPECTED_PARAMETERS_SCHEMA = Joi.object({
  required: Joi.boolean().required(),
})
  .unknown(true)
  .required()

const EXPECTED_APP_OWNED_SCHEMA = Joi.object({
  id: Joi.number().required(),
  parameters: Joi.object().pattern(Joi.any(), EXPECTED_PARAMETERS_SCHEMA),
})
  .unknown(true)
  .required()

const isAppInstallation = createSchemeGuardForInstance<AppInstallation>(
  EXPECTED_APP_INSTALLATION_SCHEMA,
  'Received an invalid value for App installation',
)

const isAppOwned = createSchemeGuardForInstance<AppOwned>(
  EXPECTED_APP_OWNED_SCHEMA,
  'Received an invalid value for App Owned',
)

// returns a list of all required parameters which are not populated
const unpopulatedParameters = (
  appInstallation: InstanceElement,
  appOwnedInstances: Record<number, InstanceElement>,
): string[] => {
  if (!isAppInstallation(appInstallation)) {
    return []
  }
  const appOwned = appOwnedInstances[appInstallation.value.app_id]
  if (appOwned?.value.parameters === undefined || !isAppOwned(appOwned)) {
    return []
  }
  const { parameters } = appOwned.value
  const requiredParameters = Object.keys(_.pickBy(parameters, val => val.required))
  const appInstallationSettings = new Set(Object.keys(appInstallation.value.settings ?? {}))
  return requiredParameters.filter(key => !appInstallationSettings.has(key))
}

/**
 * This change validator checks if all the required parameters for each app owned are populated in
 * the corresponding app installation instances. It raises an error for app installation that don't
 * have the required parameters in their setting.
 */
export const requiredAppOwnedParametersValidator: ChangeValidator = async (changes, elementSource) => {
  const appInstallationInstances = changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === APP_INSTALLATION_TYPE_NAME)
  if (_.isEmpty(appInstallationInstances) || elementSource === undefined) {
    return []
  }

  const appOwnedInstances = await getInstancesFromElementSource(elementSource, [APP_OWNED_TYPE_NAME])

  const appOwnedInstancesById: Record<number, InstanceElement> = _.keyBy(
    appOwnedInstances.filter(instance => instance.value.id !== undefined),
    'value.id',
  )

  return appInstallationInstances
    .map(appInstallation => ({
      elemID: appInstallation.elemID,
      missingRequiredParams: unpopulatedParameters(appInstallation, appOwnedInstancesById),
    }))
    .filter(appInstallationDetails => !_.isEmpty(appInstallationDetails.missingRequiredParams))
    .flatMap(({ elemID, missingRequiredParams }) => [
      {
        elemID,
        severity: 'Error',
        message: 'Cannot change app installation since some required parameters are missing',
        detailedMessage: `The following parameters are required: ${missingRequiredParams}`,
      },
    ])
}
