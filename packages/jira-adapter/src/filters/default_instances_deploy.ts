/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isInstanceChange } from '@salto-io/adapter-api'
import { defaultDeployChange, deployChanges } from '../deployment/standard_deployment'
import { FilterCreator } from '../filter'

const filter: FilterCreator = ({ client, config }) => ({
  name: 'defaultInstancesDeployFilter',
  deploy: async changes => {
    const deployResult = await deployChanges(changes.filter(isInstanceChange), async change => {
      await defaultDeployChange({ change, client, apiDefinitions: config.apiDefinitions })
    })

    return {
      leftoverChanges: [],
      deployResult,
    }
  },
})

export default filter
