/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, Element } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { LocalFilterCreator } from '../filter'
import { getInstanceAlias } from './utils'
import { isMetadataInstanceElement, MetadataInstanceElement } from '../transformers/transformer'

const { awu } = collections.asynciterable
const log = logger(module)

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'metadataInstancesAliases',
  onFetch: async (elements: Element[]): Promise<void> => {
    if (config.fetchProfile.isFeatureEnabled('skipAliases')) {
      log.debug('not adding aliases to metadata instances.')
      return
    }
    await awu(elements)
      .filter(isMetadataInstanceElement)
      .forEach(async instance => {
        instance.annotations[CORE_ANNOTATIONS.ALIAS] = await getInstanceAlias(
          instance as MetadataInstanceElement,
          config.fetchProfile.isFeatureEnabled('useLabelAsAlias'),
        )
      })
  },
})

export default filterCreator
