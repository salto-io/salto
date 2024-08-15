/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { GetCustomReferencesFunc, InstanceElement, ReferenceInfo } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getEnabledEntries } from '../config_utils'

const getReferenceInfoIdentifier = (ref: ReferenceInfo): string =>
  `${ref.source.getFullName()}-${ref.target.getFullName()}`

/**
 * Combine several getCustomReferences functions into one that will run all of them.
 * When a reference is returned twice with different types the last one will override the previous ones.
 */
export const combineCustomReferenceGetters =
  (
    customReferenceGettersByName: Record<string, GetCustomReferencesFunc>,
    getCustomRefsConfig?: (adapterConfig: InstanceElement) => Record<string, boolean>,
  ): GetCustomReferencesFunc =>
  async (elements, adapterConfig) => {
    const adapterConfigValues = adapterConfig && getCustomRefsConfig ? getCustomRefsConfig(adapterConfig) : {}
    const customReferenceGetters = Object.values(getEnabledEntries(customReferenceGettersByName, adapterConfigValues))
    const idToRef: Record<string, ReferenceInfo> = {}
    const refGroups = await Promise.all(
      customReferenceGetters.map(getCustomReferences => getCustomReferences(elements, adapterConfig)),
    )

    // We don't use _.uniqBy to ensure that the last reference will override the previous ones.
    refGroups.forEach(refs => {
      _.assign(idToRef, _.keyBy(refs, getReferenceInfoIdentifier))
    })
    return Object.values(idToRef)
  }
