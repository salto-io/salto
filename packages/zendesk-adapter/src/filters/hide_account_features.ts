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
import { CORE_ANNOTATIONS, isObjectType } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { ACCOUNT_FEATURES_TYPE_NAME } from '../constants'

const log = logger(module)

/**
 * Hide account_features settings
 */
const filterCreator: FilterCreator = () => ({
  name: 'hideAccountFeatures',
  onFetch: async elements => {
    const accountFeaturesType = elements
      .filter(isObjectType)
      .find(t => t.elemID.typeName === ACCOUNT_FEATURES_TYPE_NAME)
    if (accountFeaturesType === undefined) {
      log.warn(`Could not find ${ACCOUNT_FEATURES_TYPE_NAME} type`)
      return
    }
    accountFeaturesType.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] = true
  },
})

export default filterCreator
