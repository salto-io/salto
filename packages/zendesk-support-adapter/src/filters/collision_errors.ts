/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ZENDESK_SUPPORT } from '../constants'
import { API_DEFINITIONS_CONFIG } from '../config'

/**
 * Adds collision warnings
 */
const filterCreator: FilterCreator = ({ config }) => ({
  onFetch: async (elements: Element[]) => {
    const collistionWarnings = await getAndLogCollisionWarnings({
      adapterName: ZENDESK_SUPPORT,
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
    })
    return { errors: collistionWarnings }
  },
})

export default filterCreator
