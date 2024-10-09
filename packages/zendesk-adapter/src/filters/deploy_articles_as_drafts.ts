/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, getChangeData, InstanceElement, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { DEPLOY_CONFIG } from '../config'
import { ARTICLE_TRANSLATION_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'

/**
 * Update articles to be deployed to draft if the flag deployArticlesAsDraft is true.
 * These updates are done through article translations.
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'deployBrandedGuideTypesFilter',
  preDeploy: async (changes: Change<InstanceElement>[]) => {
    if (config[DEPLOY_CONFIG]?.deployArticlesAsDraft !== true) {
      return
    }
    changes
      .filter(isAdditionOrModificationChange)
      .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME)
      .forEach(change => {
        change.data.after.value.draft = true
      })
  },
})

export default filterCreator
