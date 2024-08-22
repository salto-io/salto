/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import Joi from 'joi'
import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { inspectValue } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { APP_OWNED_TYPE_NAME } from '../constants'

const log = logger(module)

export type AppOwnedParameter = {
  name: string
}

const EXPECTED_PARAMETERS_SCHEMA = Joi.array()
  .items(
    Joi.object({
      name: Joi.string().required(),
    }).unknown(true),
  )
  .required()

const isParameters = (values: unknown): values is AppOwnedParameter[] => {
  if (!_.isArray(values)) {
    return false
  }
  const { error } = EXPECTED_PARAMETERS_SCHEMA.validate(values)
  if (error !== undefined) {
    log.error(
      `Received an invalid response for the app_owned parameters value: ${error.message}, ${inspectValue(values)}`,
    )
    return false
  }
  return true
}

const turnParametersFieldToMap = (element: InstanceElement): void => {
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
      .forEach(elem => turnParametersFieldToMap(elem))
  },
})

export default filterCreator
