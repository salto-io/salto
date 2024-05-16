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

import { ChangeError, FixElementsFunc, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { APP_USER_SCHEMA_TYPE_NAME } from '../constants'

const log = logger(module)

const DEFINITIONS = 'definitions'
const BASE = 'base'

/**
 * Okta does not support changes in the base field in app user schema.
 * Therefore, we remove the base field in the fix element process.
 * An error with severity "Info" will be returned for each fixed instance
 */
export const removeBaseFromAppUserSchemaHandler: FixElementsFunc = async elements => {
  log.debug('start removeBaseFromAppUserSchemaHandler function')
  const appUserSchemaInstances = elements
    .filter(isInstanceElement)
    .filter(elem => elem.elemID.typeName === APP_USER_SCHEMA_TYPE_NAME)
  const fixedElements = appUserSchemaInstances.map(instance => {
    const fixedInstance = instance.clone()
    _.unset(fixedInstance.value, [DEFINITIONS, BASE])
    return fixedInstance
  })
  const errors: ChangeError[] = fixedElements.map(fixedInstance => ({
    elemID: fixedInstance.elemID,
    severity: 'Info',
    message: 'Removing the base field from app user schema',
    detailedMessage:
      'Okta does not support deploying changes in the base schema. Therefore, Salto removes the base field from the app user schema',
  }))
  return { fixedElements, errors }
}
