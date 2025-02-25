/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { InstanceElement, Change, getChangeData } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { BRAND_TYPE_NAME, CATEGORIES_FIELD } from '../constants'
import { LOGO_FIELD } from './brand_logo'

/**
 * Ignores the logo field from brand instances when deploying,
 * for they are covered as brand_logo instances
 */
const filterCreator: FilterCreator = ({ oldApiDefinitions, client, definitions }) => ({
  name: 'removeBrandLogoFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [brandChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === BRAND_TYPE_NAME,
    )
    const deployResult = await deployChanges(brandChanges, async change => {
      await deployChange({
        change,
        client,
        apiDefinitions: oldApiDefinitions,
        definitions,
        fieldsToIgnore: [LOGO_FIELD, CATEGORIES_FIELD],
      })
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
