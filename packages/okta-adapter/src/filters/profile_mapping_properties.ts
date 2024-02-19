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
import { Element, Values, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { PROFILE_MAPPING_TYPE_NAME } from '../constants'
import OktaClient from '../client/client'
import { FETCH_CONFIG } from '../config'

const log = logger(module)

const getProfileMapping = async (mappingId: string, client: OktaClient): Promise<Values> =>
  (
    await client.get({
      url: `/api/v1/mappings/${mappingId}`,
    })
  ).data as Values

/**
 * Add profile mapping properties for ProfileMapping instances
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  name: 'profileMappingPropertiesFilter',
  onFetch: async (elements: Element[]) => {
    if (config[FETCH_CONFIG].includeProfileMappingProperties === false) {
      log.debug('Fetch of profile mapping properties is disabled')
      return
    }
    const instances = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROFILE_MAPPING_TYPE_NAME)

    await Promise.all(
      instances.map(async instance => {
        const mappingId = instance.value.id
        const mappingProperties = (await getProfileMapping(mappingId, client))?.properties
        // not all mappings have properties
        if (mappingProperties === undefined) {
          return
        }
        instance.value.properties = mappingProperties
      }),
    )
  },
})

export default filterCreator
