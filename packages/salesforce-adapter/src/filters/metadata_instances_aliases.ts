/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, Element } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { getInstanceAlias } from './utils'
import { isMetadataInstanceElement, MetadataInstanceElement } from '../transformers/transformer'

const { awu } = collections.asynciterable

const filterCreator: FilterCreator = () => ({
  name: 'metadataInstancesAliases',
  onFetch: async (elements: Element[]): Promise<void> => {
    await awu(elements)
      .filter(isMetadataInstanceElement)
      .forEach(async instance => {
        instance.annotations[CORE_ANNOTATIONS.ALIAS] = await getInstanceAlias(instance as MetadataInstanceElement)
      })
  },
})

export default filterCreator
