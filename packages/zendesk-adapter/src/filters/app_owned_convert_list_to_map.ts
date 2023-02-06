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
import _ from 'lodash'
import Joi from 'joi'
import { safeJsonStringify, elementExpressionStringifyReplacer } from '@salto-io/adapter-utils'
import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { APP_OWNED_TYPE_NAME } from '../constants'

const log = logger(module)

export type AppOwnedParameter = {
  name: string
}

const EXPECTED_PARAMETERS_SCHEMA = Joi.array().items(Joi.object({
  name: Joi.string().required(),
}).unknown(true)).required()

const isParameters = (values: unknown): values is AppOwnedParameter[] => {
  if (!_.isArray(values)) {
    return false
  }
  const { error } = EXPECTED_PARAMETERS_SCHEMA.validate(values)
  if (error !== undefined) {
    log.error(`Received an invalid response for the app_owned parameters value: ${error.message}, ${safeJsonStringify(values, elementExpressionStringifyReplacer)}`)
    return false
  }
  return true
}

const turnParametersFieldToMap = (
  element: InstanceElement,
): void => {
  if (!isParameters(element.value.parameters)) {
    return
  }
  element.value.parameters = _.keyBy(element.value.parameters, 'name')
}

/**
 * Converts app_owned parameters field to map object, because the app_owned parameters
 * are a list, and therefore cannot contain hidden values.
 * There is no deploy support, because there is no suitable API for it.
 */
const filterCreator: FilterCreator = () => ({
  name: 'appOwnedConvertListToMapFilter',
  onFetch: async elements => {
    elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === APP_OWNED_TYPE_NAME)
      .filter(e => !_.isEmpty(e.value.parameters))
      .forEach(elem =>
        turnParametersFieldToMap(
          elem,
        ))
  },
})

export default filterCreator
