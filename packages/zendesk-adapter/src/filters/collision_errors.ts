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
import { isInstanceElement, Element } from '@salto-io/adapter-api'
import { config as configUtils } from '@salto-io/adapter-components'
import { getAndLogCollisionWarnings, getInstancesWithCollidingElemID } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { ZENDESK } from '../constants'
import { API_DEFINITIONS_CONFIG, FETCH_CONFIG, isGuideEnabled } from '../config'


/**
 * Adds collision warnings
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'collisionErrorsFilter',
  onFetch: async (elements: Element[]) => {
    const collistionWarnings = await getAndLogCollisionWarnings({
      adapterName: ZENDESK,
      configurationName: 'service',
      instances: getInstancesWithCollidingElemID(elements.filter(isInstanceElement)),
      getTypeName: async instance => instance.elemID.typeName,
      // TODO fix it to use apiName once we have apiName
      getInstanceName: async instance => instance.elemID.name,
      getIdFieldsByType: typeName => configUtils.getConfigWithDefault(
        config[API_DEFINITIONS_CONFIG].types[typeName]?.transformation,
        config[API_DEFINITIONS_CONFIG].typeDefaults.transformation,
      ).idFields,
      idFieldsName: 'idFields',
      // Needed because 'safeJsonStringify' is really slow, which causes problems with articles stress test (SALTO-3059)
      skipLogCollisionStringify: isGuideEnabled(config[FETCH_CONFIG]),
      docsUrl: 'https://help.salto.io/en/articles/6927157-salto-id-collisions',
    })
    return { errors: collistionWarnings }
  },
})

export default filterCreator
