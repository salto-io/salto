/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Change, getChangeData, InstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { deployChange, deployChangesSequentially } from '../deployment'
import { ROUTING_ATTRIBUTE_VALUE_TYPE_NAME } from '../constants'

/**
 * Deploys routing attribute value one by one as zendesk does not support parallel deploy
 */
const filterCreator: FilterCreator = ({ oldApiDefinitions, client, definitions }) => ({
  name: 'routingAttributeValueFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === ROUTING_ATTRIBUTE_VALUE_TYPE_NAME,
    )
    const deployResult = await deployChangesSequentially(relevantChanges, async change => {
      await deployChange({ change, client, apiDefinitions: oldApiDefinitions, definitions })
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
