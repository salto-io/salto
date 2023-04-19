/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Element, ReferenceExpression, isInstanceElement } from '@salto-io/adapter-api'
import { resolvePath } from '@salto-io/adapter-utils'
import { references as referencesUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { OKTA, PROFILE_ENROLLMENT_RULE_TYPE_NAME, USER_SCHEMA_TYPE_NAME } from '../constants'
import { getUserSchemaReference } from './expression_language'

const log = logger(module)
const { createMissingInstance } = referencesUtils

const PROFILE_ATTRIBUTES_PATH = ['actions', 'profileEnrollment', 'profileAttributes']

/**
* Add references for UserSchema attributes from ProfileEnrollmentPolicyRule
*/
const filterCreator: FilterCreator = () => ({
  name: 'profileEnrollmentAttributesFilter',
  onFetch: async (elements: Element[]) => {
    const instances = elements.filter(isInstanceElement)
    const profileEnrollmentRules = instances
      .filter(instance => instance.elemID.typeName === PROFILE_ENROLLMENT_RULE_TYPE_NAME)
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
        return
      }
      profileAttributes.forEach(att => {
        const { name } = att
        if (!_.isString(name)) {
          return
        }
        const userSchemaRef = getUserSchemaReference(name, defaultUserSchema)
        if (userSchemaRef !== undefined) {
          att.name = userSchemaRef
        } else {
          // create missing reference
          const missingInstance = createMissingInstance(OKTA, USER_SCHEMA_TYPE_NAME, name)
          att.name = new ReferenceExpression(missingInstance.elemID, missingInstance)
        }
      })
    })
  },
})

export default filterCreator
