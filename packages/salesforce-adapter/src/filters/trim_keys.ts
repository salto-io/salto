/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { MapKeyFunc, mapKeysRecursive } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { metadataType } from '../transformers/transformer'
import { LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE } from '../constants'

const { awu } = collections.asynciterable

const log = logger(module)

const trimKeys: MapKeyFunc = ({ key }) => {
  const trimmedKey = key.trim()
  if (key !== trimmedKey) {
    log.warn(`The key "${key}" is not trimmed, trimming it to avoid parsing error`)
  }
  return trimmedKey
}

const filterCreator: FilterCreator = () => ({
  name: 'trimKeysFilter',
  /**
   * Remove the leading and trailing whitespaces and new line chars from the
   * LightningComponentBundle keys to fix potential parsing error
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(async instance => (await metadataType(instance)) === LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE)
      .forEach(inst => {
        inst.value = mapKeysRecursive(inst.value, trimKeys, inst.elemID)
      })
  },
})

export default filterCreator
