/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import {
  Element, isInstanceElement,
} from '@salto-io/adapter-api'
import {
  MapKeyFunc, mapKeysRecursive,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { FilterWith } from '../filter'
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

const filterCreator = (): FilterWith<'onFetch'> => ({
  name: 'trimKeysFilter',
  /**
   * Remove the leading and trailing whitespaces and new line chars from the
   * LightningComponentBundle keys to fix potential parsing error
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(
        async instance => await metadataType(instance) === LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE
      ).forEach(inst => {
        inst.value = mapKeysRecursive(inst.value, trimKeys, inst.elemID)
      })
  },
})

export default filterCreator
