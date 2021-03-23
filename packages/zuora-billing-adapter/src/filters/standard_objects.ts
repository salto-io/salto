/*
*                      Copyright 2021 Salto Labs Ltd.
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
  Element, ObjectType, isObjectType, InstanceElement, ElemID,
} from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { pathNaclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import {
  CUSTOM_OBJECT_DEFINITION_TYPE, ZUORA_BILLING, STANDARD_OBJECT_DEFINITION_TYPE,
} from '../constants'
import { FilterCreator } from '../filter'
import { apiName } from './object_defs'
import { FETCH_CONFIG, API_DEFINITIONS_CONFIG, FilterContext } from '../config'

const log = logger(module)
const { RECORDS_PATH, swagger } = elementUtils

export const getStandardObjectTypeName = (config: FilterContext): string | undefined => {
  const apiDefs = config[API_DEFINITIONS_CONFIG]
  return Object.keys(apiDefs.types).find(
    t => apiDefs.types[t].request?.url === '/objects/definitions/com_zuora'
  )
}

/**
 * Standard objects filter.
 * Fetch standard objects separately from the main fetch, because its type is missing in the swagger
 * and we want to keep it separate from the custom objects.
 */
const filterCreator: FilterCreator = ({ paginator, config }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const standardObjectTypeName = getStandardObjectTypeName(config)
    if (
      standardObjectTypeName === undefined
      || !config[FETCH_CONFIG].includeTypes.includes(standardObjectTypeName)
    ) {
      return
    }
    const objectTypes = elements.filter(isObjectType)
    const standardObjectType = objectTypes.find(e => apiName(e) === standardObjectTypeName)
    if (standardObjectType === undefined) {
      log.error('Could not find %s object type', standardObjectTypeName)
      return
    }
    const customObjectDefType = objectTypes.find(e => apiName(e) === CUSTOM_OBJECT_DEFINITION_TYPE)
    if (customObjectDefType === undefined) {
      log.error('Could not find %s object type', CUSTOM_OBJECT_DEFINITION_TYPE)
      return
    }

    const standardObjectDefType = new ObjectType({
      ...customObjectDefType,
      elemID: new ElemID(ZUORA_BILLING, STANDARD_OBJECT_DEFINITION_TYPE),
      path: customObjectDefType.path !== undefined
        ? [...customObjectDefType.path?.slice(0, -1), STANDARD_OBJECT_DEFINITION_TYPE]
        : undefined,
    })

    const standardObjectInstances = (await swagger.getAllInstances({
      paginator,
      // only need the top-level element
      objectTypes: { [standardObjectTypeName]: standardObjectType },
      apiConfig: config[API_DEFINITIONS_CONFIG],
      fetchConfig: {
        ...config[FETCH_CONFIG],
        includeTypes: [standardObjectTypeName],
      },
    })).map(inst => new InstanceElement(
      inst.elemID.name,
      standardObjectDefType,
      inst.value,
      [ZUORA_BILLING, RECORDS_PATH, STANDARD_OBJECT_DEFINITION_TYPE,
        pathNaclCase(inst.elemID.name)],
      inst.annotations,
    ))

    elements.push(standardObjectDefType, ...standardObjectInstances)
  },
})

export default filterCreator
