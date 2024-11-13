/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Element, ElemID, InstanceElement, isObjectType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import { inspectValue, pathNaclCase } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import {
  INSTANCE_FULL_NAME_FIELD,
  RECORDS_PATH,
  SALESFORCE,
  SETTINGS_DIR_NAME,
  SETTINGS_METADATA_TYPE,
  SETTINGS_PATH,
} from '../constants'
import { apiNameSync, isInstanceOfTypeSync } from './utils'

const { isDefined } = values
const log = logger(module)

const getSettingsTypeName = (settings: InstanceElement): string | undefined => {
  const apiName = apiNameSync(settings)
  if (apiName === undefined) {
    log.error('No api name for settings type: %s', inspectValue(settings))
    return undefined
  }

  return apiName.concat(SETTINGS_METADATA_TYPE)
}

/**
 * Match instances of the Settings metadata type to their specific types.
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'settingsFilterV2',
  onFetch: async (elements: Element[]): Promise<void> => {
    if (!config.fetchProfile.isFeatureEnabled('retrieveSettings')) {
      return
    }

    const oldInstances = elements.filter(isInstanceOfTypeSync(SETTINGS_METADATA_TYPE))
    const settingsTypes = elements.filter(isObjectType).filter(type => type.annotations.dirName === SETTINGS_DIR_NAME)

    const settingsTypeByName = _(settingsTypes)
      .keyBy(type => apiNameSync(type) ?? 'missing')
      .value()
    if (settingsTypeByName.missing) {
      log.error('Got settings type with missing api name: %s', inspectValue(settingsTypeByName.missing))
    }

    const newInstances = oldInstances
      .map((instance: InstanceElement): [string | undefined, InstanceElement] => [
        getSettingsTypeName(instance),
        instance,
      ])
      .filter(
        (namedInstance: [string | undefined, InstanceElement]): namedInstance is [string, InstanceElement] =>
          namedInstance[0] !== undefined,
      )
      .map(([typeName, instance]) => {
        const type = settingsTypeByName[typeName]
        if (type === undefined) {
          log.error('Could not find type for settings instance: %s', inspectValue(instance))
          return undefined
        }

        return new InstanceElement(ElemID.CONFIG_NAME, type, instance.value, [
          SALESFORCE,
          RECORDS_PATH,
          SETTINGS_PATH,
          pathNaclCase(instance.value[INSTANCE_FULL_NAME_FIELD]),
        ])
      })
      .filter(isDefined)
    _.pullAll(elements, oldInstances)
    elements.push(...newInstances)
  },

  // after onFetch, the settings types have annotations.metadataType === '<name>Settings',
  // which causes deploy to fail (SALTO-1081).
  // We currently don't fix the metadata type in a preDeploy & onDeploy mechanism,
  // since the '<name>Settings' format is required for comparison with the type specified in the
  // deploy response, which is also in this format (after preDeploy and before onDeploy).
  // instead, we change the type in the deploy pkg (PR #1727).
})

export default filterCreator
