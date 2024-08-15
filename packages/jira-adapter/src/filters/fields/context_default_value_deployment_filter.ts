/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, InstanceElement, getChangeData, isInstanceChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { deployChanges } from '../../deployment/standard_deployment'
import { FIELD_CONTEXT_TYPE_NAME } from './constants'
import { updateDefaultValues } from './default_values'

const filter: FilterCreator = ({ client, config, elementsSource }) => ({
  name: 'contextDefaultValueDeploymentFilter',
  deploy: async changes => {
    if (!config.fetch.splitFieldContextOptions) {
      return { leftoverChanges: changes, deployResult: { errors: [], appliedChanges: [] } }
    }
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME,
    ) as [Change<InstanceElement>[], Change[]]
    const deployResult = await deployChanges(relevantChanges, async change => {
      await updateDefaultValues(change, client, config, elementsSource)
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
