/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { apiNameSync, isInstanceOfTypeSync } from './utils'
import { PROFILE_METADATA_TYPE } from '../constants'

const { awu } = collections.asynciterable

const log = logger(module)

/**
 * This filter merges the values of profile instances with their source values.
 * This is required in fetch with changes detection where we retrieve partial profile instances
 * with the modified related props only.
 */
const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'mergeProfilesWithSourceValues',
  onFetch: async elements => {
    const profileInstances = elements.filter(isInstanceOfTypeSync(PROFILE_METADATA_TYPE))
    if (!config.fetchProfile.metadataQuery.isFetchWithChangesDetection()) {
      return
    }
    log.debug(
      'about to merge the following profiles with their source values: %s',
      safeJsonStringify(profileInstances.map(instance => apiNameSync(instance))),
    )
    if (profileInstances.length === 0) {
      return
    }
    const profileValuesFromSourceByFullName = await awu(await config.elementsSource.getAll())
      .filter(isInstanceOfTypeSync(PROFILE_METADATA_TYPE))
      .reduce<Record<string, Values>>((acc, instanceFromSource) => {
        const fullName = apiNameSync(instanceFromSource)
        if (fullName === undefined) {
          log.warn('profile instance from source %s does not have fullName', instanceFromSource.elemID.getFullName())
          return acc
        }
        acc[fullName] = instanceFromSource.value
        return acc
      }, {})

    profileInstances.forEach(profileInstance => {
      profileInstance.value = _.merge(
        {},
        profileValuesFromSourceByFullName[apiNameSync(profileInstance) ?? ''] ?? {},
        profileInstance.value,
      )
    })
  },
})

export default filterCreator
