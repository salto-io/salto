/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, InstanceElement, getChangeData, isInstanceChange, isRemovalChange } from '@salto-io/adapter-api'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { OPTIONS_ORDER_TYPE_NAME } from './constants'
import { deployChanges } from '../../deployment/standard_deployment'
import { getContextAndFieldIds } from '../../common/fields'
import { deployOptionsOrder } from './context_options'

const filter: FilterCreator = ({ config, client }) => ({
  name: 'fieldContextOptionsOrderDeploymentFilter',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === OPTIONS_ORDER_TYPE_NAME,
    ) as [Change<InstanceElement>[], Change[]]
    if (!config.fetch.splitFieldContextOptions || relevantChanges.length === 0) {
      return { leftoverChanges: changes, deployResult: { errors: [], appliedChanges: [] } }
    }

    const deployResult = await deployChanges(relevantChanges, async change => {
      // no need to remove orders
      if (isRemovalChange(change)) {
        return
      }
      const { contextId, fieldId } = getContextAndFieldIds(getChangeData(change))
      const baseUrl = `/rest/api/3/field/${fieldId}/context/${contextId}/option`
      const optionsValues = collections.array
        .makeArray(getChangeData(change).value.options)
        .filter(isResolvedReferenceExpression)
        .map(optionRef => optionRef.value.value)

      await deployOptionsOrder(optionsValues, client, baseUrl)
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})
export default filter
