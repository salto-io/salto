/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { Change, getChangeData, InstanceElement, isAdditionChange, isInstanceChange } from '@salto-io/adapter-api'
import { createSaltoElementError } from '@salto-io/adapter-utils'
import { deployment } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { assignServiceIdToAdditionChange, deployChanges } from '../deprecated_deployment'
import { shouldAccessPrivateAPIs } from '../definitions/requests/clients'

const log = logger(module)

/**
 * Deploys changes of types defined with ducktype api definitions
 */
const filterCreator: FilterCreator = ({ definitions, config, oldApiDefinitions, isOAuthLogin }) => ({
  name: 'privateAPIDeployFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const { privateApiDefinitions } = oldApiDefinitions
    const adminClient = definitions.clients.options.private.httpClient
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) && privateApiDefinitions.types[getChangeData(change).elemID.typeName] !== undefined,
    )
    if (relevantChanges.length === 0) {
      return {
        leftoverChanges,
        deployResult: { errors: [], appliedChanges: [] },
      }
    }
    // TODO SALTO-5692 - replace this with checking whether deploy definitions for type exists
    if (!shouldAccessPrivateAPIs(isOAuthLogin, config)) {
      log.debug('Skip deployment of private API types because private API cannot be accessed')
      const message = 'private API is not enabled in this environment'
      const errors = relevantChanges.map(change =>
        createSaltoElementError({
          message,
          detailedMessage: message,
          severity: 'Error',
          elemID: getChangeData(change).elemID,
        }),
      )
      return {
        leftoverChanges,
        deployResult: { appliedChanges: [], errors },
      }
    }

    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change => {
      const response = await deployment.deployChange({
        change,
        client: adminClient,
        endpointDetails: privateApiDefinitions.types[getChangeData(change).elemID.typeName]?.deployRequests,
      })
      if (isAdditionChange(change)) {
        await assignServiceIdToAdditionChange(response, change)
      }
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
