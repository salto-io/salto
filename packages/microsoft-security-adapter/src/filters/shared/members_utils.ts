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
import { isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { ODATA_ID_FIELD_NACL_CASE, ODATA_TYPE_FIELD_NACL_CASE } from '../../constants'
import { MapArrayValueToChangeData } from './array_fields_deployment'
import { NAME_ID_FIELD } from '../../definitions/fetch/entra/constants'

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
