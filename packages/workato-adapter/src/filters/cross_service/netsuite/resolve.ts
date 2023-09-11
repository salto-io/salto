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
import { isInstanceElement, isObjectType } from '@salto-io/adapter-api'


const log = logger(module)

export const NETSUITE_OBJECT_REFERENCE_SEEPARATOR = '@@'
export const NETSUITE_FIELD_REFERENCE_SEPARATOR = '@'
export const NETSUITE_SCRIPT_SUFFIX = 'script'

// TODO check all netsuite optional references + check current user references
export const resolveReference : GetLookupNameFunc = async ({ ref }) => {
  if (isObjectType(ref.value)) {
    /*
      * Watch, when you build/edit netsuite related block in workato recipe, netsuite 'default' options
      * (like Customer or Employee in recomended 'Search standard records') imported without @@script suffix.
      * This behaviour isn't change anything.
      */
    return `${ref.value.elemID.typeName}${NETSUITE_OBJECT_REFERENCE_SEEPARATOR}${NETSUITE_SCRIPT_SUFFIX}` // TODO dont use elemID typeName?
  }

  if (isInstanceElement(ref.value)) { // TODO check with Joi ref.value has value.label/scriptid etc.
    return {
      label: ref.value.value.label,
      value: `${ref.value.elemID.typeName}${NETSUITE_FIELD_REFERENCE_SEPARATOR}${ref.value.value.scriptid}`,
    }
  }

  log.warn('get cross-service unknown netsuite reference') // TODO do we want to stop the deployment?
  return ref
}
