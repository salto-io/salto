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

import { logger } from '@salto-io/logging'

import { GetLookupNameFunc } from '@salto-io/adapter-utils'
import { isField, isObjectType } from '@salto-io/adapter-api'
import { apiName } from './element_index'

const log = logger(module)

export const SALESFORCE_LABEL_ANNOTATION = 'label'
export const SALESFORCE_S_OBJECT_NAME = 'sobject_name'

// TODO check all salesforce optional references + check current user references
export const resolveReference : GetLookupNameFunc = async ({ ref, path }) => {
  if (path !== undefined) { // check ref.value has annotations[SALE...]
    if (isObjectType(ref.value)) {
      if (path.name === SALESFORCE_S_OBJECT_NAME) {
        return ref.value.annotations[SALESFORCE_LABEL_ANNOTATION]
      }
      return {
        label: ref.value.annotations[SALESFORCE_LABEL_ANNOTATION],
        value: apiName(ref.value),
      }
    }

    if (isField(ref.value)) {
      return {
        label: ref.value.annotations[SALESFORCE_LABEL_ANNOTATION],
        value: ref.value.name,
      }
    }
  }

  log.warn('get cross-service netsuite reference which is not ObjectType or Field') // TODO do we want to stop the deployment?
  return ref
}
