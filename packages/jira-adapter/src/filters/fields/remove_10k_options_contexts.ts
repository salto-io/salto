/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { ERROR_MESSAGES } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { FIELD_CONTEXT_TYPE_NAME } from './constants'
import { getContextPrettyName } from '../../common/fields'
import { getOptionsFromContext } from './context_options'

const log = logger(module)

const filter: FilterCreator = ({ config }) => ({
  name: 'remove10kOptionsContexts',
  onFetch: async elements => {
    const contexts10KOptions = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
      .filter(instance => getOptionsFromContext(instance).length > 10000)

    if (contexts10KOptions.length === 0) {
      return {}
    }
    contexts10KOptions.forEach(context => {
      log.warn(
        `Context ${context.elemID.getFullName()} has more than 10K options, removing it, its options and its orders`,
      )
      if (config.fetch.remove10KOptionsContexts) {
        _.remove(elements, element => element.elemID.isEqual(context.elemID))
      }
    })
    if (!config.fetch.remove10KOptionsContexts) {
      return {}
    }
    return {
      errors: [
        {
          message: ERROR_MESSAGES.OTHER_ISSUES,
          detailedMessage:
            'The following contexts had over 10K options and were removed along with their options and orders: ' +
            `${contexts10KOptions.map(context => getContextPrettyName(context)).join(', ')}`,
          severity: 'Warning',
        },
      ],
    }
  },
})
export default filter
