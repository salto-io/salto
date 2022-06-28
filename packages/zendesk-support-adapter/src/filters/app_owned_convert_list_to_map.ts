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
import _ from 'lodash'
import Joi from 'joi'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { APP_OWNED_TYPE_NAME } from '../constants'

const log = logger(module)

type AppOwnedParameter = {
  id: number
  // eslint-disable-next-line camelcase
  app_id: number
  // eslint-disable-next-line camelcase
  created_at: string
  // eslint-disable-next-line camelcase
  updated_at: string
  name: string
  kind: string
  required: boolean
  position: number
  secure: boolean
}

const EXPECTED_PARAMETERS_SCHEMA = Joi.array().items(Joi.object({
  id: Joi.number().required(),
  // eslint-disable-next-line camelcase
  app_id: Joi.number().required(),
  // eslint-disable-next-line camelcase
  created_at: Joi.date().timestamp(),
  // eslint-disable-next-line camelcase
  updated_at: Joi.date().timestamp(),
  name: Joi.string().required(),
  kind: Joi.string().required(),
  required: Joi.boolean().required(),
  position: Joi.number().required(),
  secure: Joi.boolean().required(),
})).required()

const isParameters = (values: unknown): values is AppOwnedParameter[] => {
  const { error } = EXPECTED_PARAMETERS_SCHEMA.validate(values)
  if (error !== undefined) {
    log.error(`Received an invalid response for the app_owned parameters values: ${error.message}, ${safeJsonStringify(values)}`)
    return false
  }
  return true
}

const turnParametersFieldToMap = (
  element: InstanceElement,
): void => {
  if (isParameters(element.value.parameters)) {
    return
  }
  const paramsWithoutHiddenFields = (element.value.parameters)
  element.value.parameters = _.keyBy(paramsWithoutHiddenFields, 'name')
}

/**
 * Converts app_owned parameters field to map object, because the app_owned parameters
 * are a list, and therefore cannot contain hidden values.
 * There is no deploy support, because there is no suitable API for it.
 */
const filterCreator: FilterCreator = () => ({
  onFetch: async elements => log.time(async () => {
    elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === APP_OWNED_TYPE_NAME)
      .filter(e => !_.isEmpty(e.value.parameters))
      .forEach(ele =>
        turnParametersFieldToMap(
          ele,
        ))
  }, 'appOwnedConvertListToMap filter'),
})

export default filterCreator
