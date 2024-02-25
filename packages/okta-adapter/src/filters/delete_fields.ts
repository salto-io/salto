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
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import {
  APPLICATION_TYPE_NAME,
  AUTHORIZATION_POLICY,
  GROUP_TYPE_NAME,
  POLICY_TYPE_NAMES,
  AUTOMATION_TYPE_NAME,
} from '../constants'

const TYPES_TO_FIELDS: Record<string, string[]> = {
  [GROUP_TYPE_NAME]: ['roles'],
  [APPLICATION_TYPE_NAME]: ['AppUserSchema', 'Groups'],
  [AUTHORIZATION_POLICY]: ['policyRules'],
  [AUTOMATION_TYPE_NAME]: ['policyRules'],
  ...Object.fromEntries(POLICY_TYPE_NAMES.map(typeName => [typeName, ['policyRules']])),
  Brand: ['theme'],
}

/**
 * Delete fields that are added by the recurseInto function. This is needed because
 * fields added with recurseInto cannot be removed with fieldsToOmit.
 */
const filter: FilterCreator = () => ({
  name: 'deleteFieldsFilter',
  onFetch: async (elements: Element[]) => {
    const instancesWithFieldsToDelete = elements
      .filter(isInstanceElement)
      .filter(instance => Object.keys(TYPES_TO_FIELDS).includes(instance.elemID.typeName))
    instancesWithFieldsToDelete.forEach(instance => {
      TYPES_TO_FIELDS[instance.elemID.typeName].forEach(fieldName => {
        delete instance.value[fieldName]
      })
    })
  },
})

export default filter
