/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Change, getChangeData, InstanceElement, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { SLA_POLICY_TYPE_NAME } from '../constants'

/**
 * Deploys sla policy
 */
const filterCreator: FilterCreator = ({ oldApiDefinitions, client, definitions }) => ({
  name: 'slaPolicyFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [slaPoliciesChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        getChangeData(change).elemID.typeName === SLA_POLICY_TYPE_NAME && isAdditionOrModificationChange(change),
    )
    const deployResult = await deployChanges(slaPoliciesChanges, async change => {
      const clonedChange = await applyFunctionToChangeData(change, inst => inst.clone())
      const instance = getChangeData(clonedChange)
      instance.value.filter = instance.value.filter ?? { all: [], any: [] }
      await deployChange({
        change: clonedChange,
        client,
        apiDefinitions: oldApiDefinitions,
        definitions,
      })
      getChangeData(change).value.id = instance.value.id
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
