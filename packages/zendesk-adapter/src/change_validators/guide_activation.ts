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
import {
  ChangeValidator,
  getChangeData,
  isModificationChange, InstanceElement, Change, isInstanceChange,
} from '@salto-io/adapter-api'
import Joi from 'joi'
import { createSchemeGuardForInstance } from '@salto-io/adapter-utils'
import { BRAND_TYPE_NAME } from '../constants'

type BrandType = InstanceElement & {
  value: {
    // eslint-disable-next-line camelcase
    help_center_state: string
    // eslint-disable-next-line camelcase
    has_help_center: boolean
    // eslint-disable-next-line camelcase
    brand_url: string
  }
}

const BRAND_SCHEMA = Joi.object({
  help_center_state: Joi.string().required(),
  has_help_center: Joi.boolean().required(),
  brand_url: Joi.string().required(),
}).unknown(true).required()


export const isBrand = createSchemeGuardForInstance<BrandType>(
  BRAND_SCHEMA, 'Received an invalid value for brand'
)

export const invalidBrandChange = (change: Change<InstanceElement>, fieldToCheck: 'has_help_center' | 'help_center_state')
    : boolean => {
  if (!isBrand(getChangeData(change))) {
    return false
  }
  return isModificationChange(change)
    && (change.data.before.value[fieldToCheck] !== change.data.after.value[fieldToCheck])
}

/**
 * This change validator checks that the field 'help_center_state' in a brand has not been changed
 * since Salto does not support the change of the help center (guide) state (enabled or restricted)
 */
export const helpCenterActivationValidator: ChangeValidator = async changes => {
  const relevantInstances = changes
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === BRAND_TYPE_NAME)
    .filter(change => invalidBrandChange(change, 'help_center_state'))
    .map(getChangeData)

  return relevantInstances
    .flatMap(instance => [{
      elemID: instance.elemID,
      severity: 'Warning',
      message: 'Activation or deactivation of help center for a certain brand is not supported via Salto.',
      detailedMessage: `Activation or deactivation of help center for a certain brand is not supported via Salto. To activate or deactivate a help center, please go to ${instance.value.brand_url}/hc/admin/general_settings`,
    }])
}
