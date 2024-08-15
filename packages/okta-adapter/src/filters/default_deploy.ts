/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import _ from 'lodash'
import { Change, getChangeData, InstanceElement, isInstanceChange } from '@salto-io/adapter-api'
import { definitions as definitionUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { defaultDeployWithStatus, deployChanges } from '../deprecated_deployment'

const { queryWithDefault } = definitionUtils

/**
 * Deploys all the changes that were not deployed by the previous filters
 */
const filterCreator: FilterCreator = ({ definitions, oldApiDefinitions }) => ({
  name: 'oldDefaultDeployFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [newInfraChanges, oldInfraChanges] = _.partition(changes, change =>
      queryWithDefault(definitions.deploy?.instances ?? {})
        .allKeys()
        .includes(getChangeData(change).elemID.typeName),
    )
    const client = definitions.clients.options.main.httpClient
    const deployResult = await deployChanges(oldInfraChanges.filter(isInstanceChange), async change => {
      await defaultDeployWithStatus(change, client, oldApiDefinitions.apiDefinitions)
    })
    return { deployResult, leftoverChanges: newInfraChanges }
  },
})

export default filterCreator
