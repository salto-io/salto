/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { VARIANTS_FIELD_NAME } from '../filters/dynamic_content'
import { DYNAMIC_CONTENT_ITEM_TYPE_NAME } from '../constants'

export const emptyVariantsValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === DYNAMIC_CONTENT_ITEM_TYPE_NAME)
    .flatMap(instance => {
      if (_.isEmpty(instance.value[VARIANTS_FIELD_NAME])) {
        return [
          {
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Cannot make this change due to missing variants',
            detailedMessage: 'Dynamic content item must have at least one variant',
          },
        ]
      }
      return []
    })
