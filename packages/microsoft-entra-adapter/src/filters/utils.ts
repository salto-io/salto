/*
 *                      Copyright 2024 Salto Labs Ltd.
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

import { validatePlainObject } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { isReferenceExpression } from '@salto-io/adapter-api'
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

  const refValue = _.get(memberRef, 'resValue.value')
  validatePlainObject(refValue, 'member reference value')
  const id = _.get(refValue, 'id')
  if (!_.isString(id)) {
    throw new Error('Invalid member reference value, missing id')
  }
  return {
    id,
    name: `${_.get(refValue, NAME_ID_FIELD.fieldName)}_${odataType}`,
    [ODATA_ID_FIELD_NACL_CASE]: `https://graph.microsoft.com/v1.0/groups/${id}`,
  }
}
