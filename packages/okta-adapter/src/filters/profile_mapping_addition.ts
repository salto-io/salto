/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import _ from 'lodash'
import { Change, InstanceElement, isInstanceChange, getChangeData, isAdditionChange } from '@salto-io/adapter-api'
import { inspectValue } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { PROFILE_MAPPING_TYPE_NAME } from '../constants'
import { API_DEFINITIONS_CONFIG, OktaSwaggerApiConfig } from '../config'
import { FilterCreator } from '../filter'
import { deployChanges, defaultDeployChange } from '../deprecated_deployment'

const log = logger(module)

const getMappingIdBySourceAndTarget = async (
  sourceId: string,
  targetId: string,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
): Promise<string> => {
  const mappingEntries = (
    await client.get({
      url: '/api/v1/mappings',
      queryParams: { sourceId, targetId },
    })
  ).data
  if (_.isArray(mappingEntries) && mappingEntries.length === 1 && _.isString(mappingEntries[0].id)) {
    return mappingEntries[0].id
  }
  log.error(`Recieved unexpected result for profile mapping: ${inspectValue(mappingEntries)}`)
  throw new Error('Could not find ProfileMapping with the provided sourceId and targetId')
}

const deployProfileMappingAddition = async (
  change: Change<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
  apiDefinitions: OktaSwaggerApiConfig,
): Promise<void> => {
  const instance = getChangeData(change)
  const sourceId = instance.value.source?.id
  const targetId = instance.value.target?.id
  if (!_.isString(sourceId) || !_.isString(targetId)) {
    // references are already resolved
    log.error(
      `Failed to deploy ProfileMapping with sourceId: ${inspectValue(sourceId)}, targetId: ${inspectValue(targetId)}`,
    )
    throw new Error('ProfileMapping must have valid sourceId and targetId')
  }
  const mappingId = await getMappingIdBySourceAndTarget(sourceId, targetId, client)
  // Assign the existing id to the added profile mapping
  instance.value.id = mappingId
  await defaultDeployChange(change, client, apiDefinitions)
}

/**
 * Deploy addition changes of ProfileMapping instances,
 * by finding the id of the existing ProfileMapping and update it
 */
const filterCreator: FilterCreator = ({ definitions, oldApiDefinitions }) => ({
  name: 'profileMappingAdditionFilter',
  deploy: async changes => {
    const client = definitions.clients.options.main.httpClient
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) &&
        isAdditionChange(change) &&
        getChangeData(change).elemID.typeName === PROFILE_MAPPING_TYPE_NAME,
    )

    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change =>
      deployProfileMappingAddition(change, client, oldApiDefinitions[API_DEFINITIONS_CONFIG]),
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filterCreator
