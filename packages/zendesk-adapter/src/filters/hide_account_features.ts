/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
