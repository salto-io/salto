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
import { resolvePath } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { PROFILE_ENROLLMENT_RULE_TYPE_NAME, USER_SCHEMA_TYPE_NAME } from '../constants'
import { getUserSchemaReference } from './expression_language'

const log = logger(module)

const PROFILE_ATTRIBUTES_PATH = ['actions', 'profileEnrollment', 'profileAttributes']

/**
 * Add references for UserSchema attributes from ProfileEnrollmentPolicyRule
 */
const filterCreator: FilterCreator = () => ({
  name: 'profileEnrollmentAttributesFilter',
  onFetch: async (elements: Element[]) => {
    const instances = elements.filter(isInstanceElement)
    const profileEnrollmentRules = instances.filter(
      instance => instance.elemID.typeName === PROFILE_ENROLLMENT_RULE_TYPE_NAME,
    )
    const defaultUserSchema = instances
      .filter(instance => instance.elemID.typeName === USER_SCHEMA_TYPE_NAME)
      .find(instance => instance.elemID.name === 'user')
    if (defaultUserSchema === undefined) {
      log.error('Could not find the default UserSchema instance, skipping profileEnrollmentAttributesFilter')
      return
    }

    profileEnrollmentRules.forEach(rule => {
      const profileAttributes = resolvePath(rule, rule.elemID.createNestedID(...PROFILE_ATTRIBUTES_PATH))
      if (!Array.isArray(profileAttributes)) {
        log.warn(`Can not create references from instance ${rule.elemID.getFullName()} to user schema attributes`)
        return
      }
      profileAttributes.forEach(att => {
        const { name } = att
        if (!_.isString(name)) {
          log.warn(`Unexpected name field in profileAttributes for instance: ${rule.elemID.getFullName()}`)
          return
        }
        const userSchemaRef = getUserSchemaReference(name, defaultUserSchema)
        if (userSchemaRef !== undefined) {
          att.name = userSchemaRef
        }
      })
    })
  },
})

export default filterCreator
