/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { validatePlainObject } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { ODATA_TYPE_FIELD_NACL_CASE, ODATA_ID_FIELD_NACL_CASE } from '../constants'
import { NAME_ID_FIELD } from '../definitions/fetch/constants'
import { MapArrayValueToChangeData } from './array_fields_deployment'

export const mapMemberRefToChangeData: MapArrayValueToChangeData = value => {
  validatePlainObject(value, 'member reference')

  const memberRef = _.get(value, 'id')
  const odataType = _.get(value, ODATA_TYPE_FIELD_NACL_CASE)
  if (!isReferenceExpression(memberRef) || !_.isString(odataType)) {
    throw new Error('Invalid member reference, missing id reference or OData type')
  }

  const refInstance = memberRef.value
  if (!isInstanceElement(refInstance)) {
    throw new Error('Invalid member reference value, expecting instance element')
  }

  const id = _.get(refInstance.value, 'id')
  if (!_.isString(id)) {
    throw new Error('Invalid member reference value, missing id')
  }
  return {
    id,
    name: `${_.get(refInstance.value, NAME_ID_FIELD.fieldName)}_${odataType}`,
    [ODATA_ID_FIELD_NACL_CASE]: `https://graph.microsoft.com/v1.0/groups/${id}`,
  }
}
