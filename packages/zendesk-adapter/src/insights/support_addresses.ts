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

import { GetInsightsFunc, getRestriction, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { SUPPORT_ADDRESS_TYPE_NAME } from '../constants'

const SUPPORT_ADDRESS = 'supportAddress'

const isSupportAddressInstance = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === SUPPORT_ADDRESS_TYPE_NAME

const isInstanceWithUnverifiedFields = (instance: InstanceElement): boolean => {
  const type = instance.getTypeSync()
  return Object.values(type.fields).some(
    field =>
      getRestriction(field).values?.includes('verified') &&
      instance.value[field.name] !== undefined &&
      instance.value[field.name] !== 'verified',
  )
}

const getInsights: GetInsightsFunc = elements => {
  const instances = elements.filter(isInstanceElement).filter(isSupportAddressInstance)

  const instancesWithUnverifiedFields = instances.filter(isInstanceWithUnverifiedFields).map(instance => ({
    path: instance.elemID,
    ruleId: `${SUPPORT_ADDRESS}.unverifiedFields`,
    message: 'Support Address has unverified fields',
  }))

  return instancesWithUnverifiedFields
}

export default getInsights
