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
import { CORE_ANNOTATIONS, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { ACCOUNT_FEATURES_TYPE_NAME } from '../constants'

const log = logger(module)

/**
 * Hide account_features settings instance
 */
const filterCreator: FilterCreator = () => ({
  name: 'hideAccountFeaturesInstance',
  onFetch: async elements => {
    const accountFeaturesInstance = elements
      .filter(isInstanceElement)
      .find(i => i.elemID.typeName === ACCOUNT_FEATURES_TYPE_NAME)
    if (accountFeaturesInstance === undefined) {
      log.warn('Could not find account_features instance')
      return
    }
    accountFeaturesInstance.annotations[CORE_ANNOTATIONS.HIDDEN] = true
  },
})

export default filterCreator
