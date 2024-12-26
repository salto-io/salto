/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { Values } from '@salto-io/adapter-api'
import { validatePlainObject } from '@salto-io/adapter-utils'
import { PARENT_ID_FIELD_NAME } from '../../../../constants'

/*
 * Add parent_id to fields that will be extracted from the parent object.
 * Ensures uniqueness in serviceId for fields whose IDs uniqueness is parent-contextual.
 */
export const addParentIdToStandaloneFields = ({ fieldPath, value }: { fieldPath: string[]; value: Values }): object[] =>
  _.get(value, fieldPath, []).map((obj: unknown) => {
    validatePlainObject(obj, fieldPath.join('.'))
    return {
      [PARENT_ID_FIELD_NAME]: value.id,
      ...obj,
    }
  })
