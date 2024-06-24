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
import { SeverityLevel, Value, getChangeData, isInstanceChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import Joi from 'joi'
import { logger } from '@salto-io/logging'
import { createSchemeGuard, getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { PROJECT_TYPE, SCRIPT_FRAGMENT_TYPE } from '../../constants'
import { getValuesToDeploy } from './script_runner_listeners_deploy'

const log = logger(module)

type FragmentsResponse = unknown[]
const FRAGMENTS_RESPONSE_SCHEME = Joi.array().required()
const isFragmentsResponse = createSchemeGuard<FragmentsResponse>(
  FRAGMENTS_RESPONSE_SCHEME,
  'Received an invalid scripted fragments response',
)

type Fragments = {
  entities: string[]
  id: string
  panelLocation: string
}
const FRAGMENTS_ARRAY_SCHEME = Joi.array()
  .items(
    Joi.object({
      entities: Joi.array().items(Joi.string()).required(),
      id: Joi.string().required(),
      panelLocation: Joi.string().required(),
    })
      .required()
      .unknown(true),
  )
  .required()
const isFragmentsArray = createSchemeGuard<Fragments[]>(
  FRAGMENTS_ARRAY_SCHEME,
  'Received an invalid scripted fragments response',
)

type FragmentsProjectsProperties = {
  fragments: string[]
  panelLocations: string[]
}

const getProjectToPropertiesMap = (FragmentsValues: Fragments[]): Record<string, FragmentsProjectsProperties> => {
  const projectToPropertiesMap: Record<string, FragmentsProjectsProperties> = {}
  FragmentsValues.forEach(value => {
    value.entities.forEach((projectKey: string) => {
      if (projectToPropertiesMap[projectKey] === undefined) {
        projectToPropertiesMap[projectKey] = {
          fragments: [],
          panelLocations: [],
        }
      }
      const properties = projectToPropertiesMap[projectKey]
      properties.fragments.push(value.id)
      // for some reason all panel locations requires 0 at the end, for instance
      // atl.jira.view.issue.right.context0. Did not encounter a case it was not 0,
      // even when there are several in the same location
      properties.panelLocations.push(`${value.panelLocation}0`)
    })
  })
  return projectToPropertiesMap
}

// This filter deploys scripted fragments as a batch
const filter: FilterCreator = ({ client, scriptRunnerClient, config, elementsSource }) => ({
  name: 'scriptedFragmentsBatchDeployFilter',
  deploy: async changes => {
    const { scriptRunnerApiDefinitions } = config
    if (!config.fetch.enableScriptRunnerAddon || scriptRunnerApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }

    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === SCRIPT_FRAGMENT_TYPE,
    )
    if (relevantChanges.length === 0) {
      return {
        leftoverChanges,
        deployResult: { errors: [], appliedChanges: [] },
      }
    }
    let fragmentsFromService: Value[]
    try {
      const response = await scriptRunnerClient.get({
        url: '/sr-dispatcher/jira/token/script-fragments',
      })
      if (!isFragmentsResponse(response.data)) {
        throw new Error('Received an invalid scripted fragments response')
      }
      fragmentsFromService = response.data
    } catch (e) {
      log.error(`Failed to get scripted fragments with the error: ${e}`)
      return {
        leftoverChanges,
        deployResult: {
          errors: relevantChanges.map(getChangeData).map(instance => ({
            severity: 'Error' as SeverityLevel,
            message: 'Error getting other scripted fragments information from the service',
            elemID: instance.elemID,
          })),
          appliedChanges: [],
        },
      }
    }
    const {
      errors,
      appliedChanges,
      valuesToDeploy: fragmentValuesToDeploy,
    } = await getValuesToDeploy({
      changes: relevantChanges,
      valuesFromService: fragmentsFromService,
      identifier: 'id',
      scriptRunnerApiDefinitions,
    })
    if (!isFragmentsArray(fragmentValuesToDeploy)) {
      return {
        leftoverChanges,
        deployResult: {
          errors: relevantChanges.map(getChangeData).map(instance => ({
            severity: 'Error' as SeverityLevel,
            message: 'Error getting other scripted fragments information from the service',
            elemID: instance.elemID,
          })),
          appliedChanges: [],
        },
      }
    }
    try {
      await scriptRunnerClient.put({
        url: '/sr-dispatcher/jira/admin/token/script-fragments',
        data: fragmentValuesToDeploy,
      })
      const projects = await getInstancesFromElementSource(elementsSource, [PROJECT_TYPE])

      const projectToPropertiesMap = getProjectToPropertiesMap(fragmentValuesToDeploy)

      await Promise.all(
        projects.map(async project => {
          const projectKey = project.value.key
          const { fragments, panelLocations } = projectToPropertiesMap[projectKey] ?? {
            fragments: [],
            panelLocations: [],
          }
          const currentEpoch = Date.now()
          return client.put({
            url: `/rest/api/2/project/${projectKey}/properties/enabled-script-fragments?_r=${currentEpoch}`,
            data: {
              fragments,
              itemLocations: [],
              panelLocations,
            },
          })
        }),
      )
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : e
      log.error(`Failed to put scripted fragments with the error: ${errorMessage}`)
      errors.push(
        ...appliedChanges.map(getChangeData).map(instance => ({
          severity: 'Error' as SeverityLevel,
          message: `${errorMessage}`,
          elemID: instance.elemID,
        })),
      )
      return {
        deployResult: { appliedChanges: [], errors },
        leftoverChanges,
      }
    }
    return {
      deployResult: { appliedChanges, errors },
      leftoverChanges,
    }
  },
})

export default filter
