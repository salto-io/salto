/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { getChangeData, isInstanceChange, Change, InstanceElement } from '@salto-io/adapter-api'
import { deployChange, deployChanges } from '../deployment'
import { FilterCreator } from '../filter'
import { GUIDE_TYPES_TO_HANDLE_BY_BRAND } from '../config'

/**
 * Deploys Guide types which relate to a certain brand
 */
const filterCreator: FilterCreator = ({ oldApiDefinitions, client, definitions }) => ({
  name: 'deployBrandedGuideTypesFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [guideBrandedTypesChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        GUIDE_TYPES_TO_HANDLE_BY_BRAND.includes(getChangeData(change).elemID.typeName) && isInstanceChange(change),
    )
    const deployResult = await deployChanges(guideBrandedTypesChanges, async change => {
      await deployChange({
        change,
        client,
        apiDefinitions: oldApiDefinitions,
        definitions,
        fieldsToIgnore: ['brand'],
      })
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
