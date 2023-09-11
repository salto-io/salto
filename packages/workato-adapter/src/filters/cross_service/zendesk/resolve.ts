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
import { ElemID, isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import _ from 'lodash'
import { isOptionValueInstance } from './element_index'

const log = logger(module)
const isIdPath = (path: ElemID): boolean => (['id', 'group_id', 'brand_id', 'ticket_form_id'].includes(path.name))

export const resolveReference : GetLookupNameFunc = async ({ ref, path }) => {
  if (path !== undefined && isReferenceExpression(ref) && isInstanceElement(ref.value)) {
    if (isIdPath(path) && ref.value.value.id !== undefined) {
      return _.toString(ref.value.value.id)
    }

    if (path.name.startsWith('field_') && isOptionValueInstance(ref.value)) {
      return ref.value.value.value
    }
  }

  log.warn('get cross-service unknown zendesk reference') // TODO do we want to stop the deployment?
  return ref
}
