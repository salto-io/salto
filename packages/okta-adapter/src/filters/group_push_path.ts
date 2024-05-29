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
import { getParent } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { GROUP_PUSH_TYPE_NAME, GROUP_PUSH_RULE_TYPE_NAME, OKTA } from '../constants'

const log = logger(module)
const { RECORDS_PATH } = elementUtils

/**
 * Modify GroupPush and GroupPushRule instances paths to be nested under the parent application.
 * The filter is needed because currently "nestStandaloneInstances" cannot be used,
 * as GroupPush and GroupPushRule instances are not standalone fields of Applications.
 */
const groupPushPathFilter: FilterCreator = () => ({
  name: 'groupPushPathFilter',
  onFetch: async (elements: Element[]) => {
    const groupPushInstances = elements
      .filter(isInstanceElement)
      .filter(
        instance =>
          instance.elemID.typeName === GROUP_PUSH_TYPE_NAME || instance.elemID.typeName === GROUP_PUSH_RULE_TYPE_NAME,
      )

    groupPushInstances.forEach(instance => {
      try {
        const parentApp = getParent(instance)
        instance.path = parentApp.path
          ? [
              OKTA,
              RECORDS_PATH,
              ...parentApp.path.slice(2, parentApp.path.length - 1),
              instance.elemID.typeName,
              instance.elemID.name,
            ]
          : instance.path
      } catch (err) {
        log.warn('Failed to modify path for instance %s, error: %o', instance.elemID.getFullName(), err)
      }
    })
  },
})

export default groupPushPathFilter
