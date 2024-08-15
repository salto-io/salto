/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { FIELD_TYPE_NAME } from '../fields/constants'

const log = logger(module)

const filter: FilterCreator = ({ fetchQuery }) => ({
  name: 'fieldConfigurationIrrelevantFields',
  onFetch: async elements => {
    if (!fetchQuery.isTypeMatch(FIELD_TYPE_NAME)) {
      log.warn(
        'Field type is not included in the fetch list so we cannot know what fields is in trash. Skipping the field_configuration_trashed_fields',
      )
      return
    }

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === 'FieldConfiguration')
      .filter(instance => instance.value.fields !== undefined)
      .forEach(instance => {
        const [fields, trashedFields] = _.partition(
          instance.value.fields,
          field => isResolvedReferenceExpression(field.id) && !field.id.value.value.isLocked,
        )
        instance.value.fields = fields
        if (trashedFields.length !== 0) {
          log.debug(
            `Removed from ${instance.elemID.getFullName()} fields with ids: ${trashedFields.map(field => (isResolvedReferenceExpression(field.id) ? field.id.elemID.getFullName() : field.id)).join(', ')}`,
          )
        }
      })
  },
})

export default filter
