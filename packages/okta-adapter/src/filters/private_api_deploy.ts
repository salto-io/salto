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
  SaltoError,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { CLIENT_CONFIG } from '../config'
import { assignServiceIdToAdditionChange, deployChanges } from '../deployment'

const log = logger(module)

/**
 * Deploys changes of types defined with ducktype api definitions
 */
const filterCreator: FilterCreator = ({ adminClient, config }) => ({
  name: 'privateAPIDeployFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const { privateApiDefinitions } = config
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
    if (config[CLIENT_CONFIG]?.usePrivateAPI !== true) {
      log.debug('Skip deployment of private API types because private API is not enabled')
      const errors = relevantChanges.map(change =>
        createSaltoElementError({
          message: 'usePrivateApi config option must be enabled in order to deploy this change',
          severity: 'Error',
          elemID: getChangeData(change).elemID,
        }),
      )
      return {
        leftoverChanges,
        deployResult: { appliedChanges: [], errors },
      }
    }
    if (adminClient === undefined) {
      log.error('Skip deployment of private API types because adminClient does not exist')
      const error: SaltoError = {
        message: `The following changes were not deployed, due to error with the private API client: ${relevantChanges.map(c => getChangeData(c).elemID.getFullName()).join(', ')}`,
        severity: 'Error',
      }
      return {
        leftoverChanges,
        deployResult: { appliedChanges: [], errors: [error] },
      }
    }
    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change => {
      const response = await deployment.deployChange({
        change,
        client: adminClient,
        endpointDetails: privateApiDefinitions.types[getChangeData(change).elemID.typeName]?.deployRequests,
      })
      if (isAdditionChange(change)) {
        assignServiceIdToAdditionChange(response, change, privateApiDefinitions)
      }
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
