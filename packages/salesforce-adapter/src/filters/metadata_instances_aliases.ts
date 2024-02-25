/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { CORE_ANNOTATIONS, Element } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { LocalFilterCreator } from '../filter'
import { getInstanceAlias } from './utils'
import {
  isMetadataInstanceElement,
  MetadataInstanceElement,
} from '../transformers/transformer'

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
      .forEach(async (instance) => {
        instance.annotations[CORE_ANNOTATIONS.ALIAS] = await getInstanceAlias(
          instance as MetadataInstanceElement,
          config.fetchProfile.isFeatureEnabled('useLabelAsAlias'),
        )
      })
  },
})

export default filterCreator
