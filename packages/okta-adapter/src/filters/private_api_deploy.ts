/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  Change,
  createSaltoElementError,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { assignServiceIdToAdditionChange, deployChanges } from '../deployment'
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
      const errors = relevantChanges.map(change =>
        createSaltoElementError({
          message: 'private API is not enabled in this environment',
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
