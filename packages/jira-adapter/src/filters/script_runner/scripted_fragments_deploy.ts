/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { PROJECT_TYPE, SCRIPT_FRAGMENT_TYPE } from '../../constants'
import { getValuesToDeploy } from './script_runner_listeners_deploy'

const { awu } = collections.asynciterable

const log = logger(module)

type FragmentsResponse = Value[]

const FRAGMENTS_RESPONSE_SCHEME = Joi.array().required()

const isFragmentsResponse = createSchemeGuard<FragmentsResponse>(FRAGMENTS_RESPONSE_SCHEME, 'Received an invalid scripted fragments response')

type FragmentsProjectsProperties = {
  fragments: string[]
  panelLocations: string[]
}

const getProjectToPropertiesMap = (valuesToDeploy: Value[]): Record<string, FragmentsProjectsProperties> => {
  const projectToPropertiesMap: Record<string, FragmentsProjectsProperties> = {}
  valuesToDeploy.forEach(value => {
    value.entities.forEach((projectKey: string) => {
      if (projectToPropertiesMap[projectKey] === undefined) {
        projectToPropertiesMap[projectKey] = {
          fragments: [],
          panelLocations: [],
        }
      }
      const properties = projectToPropertiesMap[projectKey]
      properties.fragments.push(value.id)
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
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === SCRIPT_FRAGMENT_TYPE,
    )
    if (relevantChanges.length === 0) {
      return {
        leftoverChanges,
        deployResult: { errors: [], appliedChanges: [] },
      }
    }
    let valuesFromService: Value[]
    try {
      const response = await scriptRunnerClient
        .getSinglePage({
          url: '/sr-dispatcher/jira/token/script-fragments',
        })
      if (!isFragmentsResponse(response.data)) {
        throw new Error('Received an invalid scripted fragments response')
      }
      valuesFromService = response.data
    } catch (e) {
      return {
        leftoverChanges,
        deployResult: {
          errors: relevantChanges
            .map(getChangeData)
            .map(instance => ({
              severity: 'Error' as SeverityLevel,
              message: 'Error getting other scripted fragments information from the service',
              elemID: instance.elemID,
            })),
          appliedChanges: [],
        },
      }
    }
    const { errors, appliedChanges, valuesToDeploy } = await getValuesToDeploy(relevantChanges, valuesFromService, 'id')
    try {
      await scriptRunnerClient.put({
        url: '/sr-dispatcher/jira/admin/token/script-fragments',
        data: valuesToDeploy,
      })
      const projects = await awu(await elementsSource.list())
        .filter(id => id.idType === 'instance' && id.typeName === PROJECT_TYPE)
        .map(id => elementsSource.get(id))
        .toArray()

      const projectToPropertiesMap = getProjectToPropertiesMap(valuesToDeploy)

      await awu(projects)
        .forEach(async project => {
          const projectKey = project.value.key
          const { fragments, panelLocations } = projectToPropertiesMap[projectKey]
            ?? { fragments: [], panelLocations: [] }
          const currentEpoch = Date.now()
          await client.put({
            url: `/rest/api/2/project/${projectKey}/properties/enabled-script-fragments?_r=${currentEpoch}`,
            data: {
              fragments,
              itemLocations: [],
              panelLocations,
            },
          })
        })
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : e
      log.error(`Failed to put scripted fragments with the error: ${errorMessage}`)
      errors.push(...appliedChanges
        .map(getChangeData)
        .map(instance => ({
          severity: 'Error' as SeverityLevel,
          message: `${errorMessage}`,
          elemID: instance.elemID,
        })))
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
