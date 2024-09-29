/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { inspectValue } from '@salto-io/adapter-utils'
import { ElemID, InstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { ArtificialTypes } from '../constants'
import { LocalFilterCreator } from '../filter'
import { buildElementsSourceForFetch, ensureSafeFilterFetch } from './utils'
import {
  getProfilesAndPsBrokenReferenceFields,
  isProfileOrPermissionSetInstance,
} from '../custom_references/profiles_and_permission_sets'

const log = logger(module)
const { toArrayAsync } = collections.asynciterable

const filter: LocalFilterCreator = ({ config }) => ({
  name: 'profilesAndPermissionSetsBrokenPaths',
  onFetch: ensureSafeFilterFetch({
    config,
    warningMessage: 'Error occurred while calculating Profiles and PermissionSets broken paths',
    fetchFilterFunc: async elements => {
      const elementsSource = buildElementsSourceForFetch(elements, config)
      const profilesAndPermissionSets = (await toArrayAsync(await elementsSource.getAll())).filter(
        isProfileOrPermissionSetInstance,
      )
      if (profilesAndPermissionSets.length === 0) {
        return
      }
      const { paths } = await getProfilesAndPsBrokenReferenceFields({
        elementsSource,
        profilesAndPermissionSets,
        config,
      })
      const uniquePaths = new Set(paths)
      if (uniquePaths.size === 0) {
        return
      }
      log.debug('Profiles and PermissionSets broken paths: %s', inspectValue(uniquePaths, { maxArrayLength: 100 }))
      elements.push(
        new InstanceElement(ElemID.CONFIG_NAME, ArtificialTypes.ProfilesAndPermissionSetsBrokenPaths, {
          paths: uniquePaths,
        }),
      )
    },
  }),
})

export default filter
