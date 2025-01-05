/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, InstanceElement, isInstanceChange } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'

/**
 * Deploys all the changes that were not deployed by the previous filters
 */
const filterCreator: FilterCreator = ({ oldApiDefinitions, client }) => ({
  name: 'defaultDeployFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const deployResult = await deployChanges(changes.filter(isInstanceChange), async change => {
      await deployChange(change, client, oldApiDefinitions)
    })
    return { deployResult, leftoverChanges: [] }
  },
})

export default filterCreator
