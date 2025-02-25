/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Change, getChangeData, InstanceElement, isRemovalChange } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { ROUTING_ATTRIBUTE_TYPE_NAME } from '../constants'

/**
 * Deploys routing attribute
 */
const filterCreator: FilterCreator = ({ oldApiDefinitions, client, definitions }) => ({
  name: 'routingAttributeFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === ROUTING_ATTRIBUTE_TYPE_NAME && !isRemovalChange(change),
    )
    const deployResult = await deployChanges(relevantChanges, async change => {
      await deployChange({
        change,
        client,
        apiDefinitions: oldApiDefinitions,
        definitions,
        fieldsToIgnore: ['values'],
      })
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
