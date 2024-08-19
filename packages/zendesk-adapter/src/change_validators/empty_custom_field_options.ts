/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { CUSTOM_FIELD_OPTIONS_FIELD_NAME, FIELD_TYPE_NAMES } from '../constants'

const RELEVANT_FIELD_TYPES = ['dropdown', 'tagger', 'multiselect']

export const emptyCustomFieldOptionsValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => FIELD_TYPE_NAMES.includes(instance.elemID.typeName))
    .flatMap(instance => {
      if (
        RELEVANT_FIELD_TYPES.includes(instance.value.type) &&
        _.isEmpty(instance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME])
      ) {
        return [
          {
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Cannot make this change since dropdown, tagger and multi-select fields can’t to be empty',
            detailedMessage: 'Custom field options are required for dropdown, tagger and multi select fields',
          },
        ]
      }
      return []
    })
