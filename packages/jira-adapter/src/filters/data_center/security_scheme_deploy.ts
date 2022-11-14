/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { getChangeData, isAdditionChange, isInstanceChange } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { SECURITY_LEVEL_TYPE, SECURITY_SCHEME_TYPE } from '../../constants'
import { JiraApiConfig } from '../../config/api_config'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { FilterCreator } from '../../filter'


const SUPPORTED_TYPES = {
  SecurityScheme: ['SecuritySchemes'],
}

const DATA_CENTER_TYPE_CUSTOMIZATIONS: JiraApiConfig['types'] = {
  // Cloud platform API
  SecurityScheme: {
    deployRequests: {
      add: {
        url: 'rest/salto/1.0/issuesecurityschemes?name={name}&description={description}',
        method: 'post',
      },
    },
  },
  SecurityLevel: {
    deployRequests: {
      add: {
        url: 'rest/salto/1.0/securitylevel?securitySchemeId={schemeId}',
        method: 'post',
      },
    },
  },
}

const DC_REDUCED_API_DEFINITIONS: JiraApiConfig = {
  platformSwagger: {
    url: '',
  },
  jiraSwagger: {
    url: '',
  },
  typeDefaults: {
    transformation: {
      idFields: [],
    },
  },
  types: DATA_CENTER_TYPE_CUSTOMIZATIONS,
  typesToFallbackToInternalId: [],
  supportedTypes: SUPPORTED_TYPES,
}

const filter: FilterCreator = ({ client }) => ({
  deploy: async changes => {
    if (!client.isDataCenter) {
      return { deployResult: { appliedChanges: [], errors: [] }, leftoverChanges: changes }
    }
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && (
          getChangeData(change).elemID.typeName === SECURITY_SCHEME_TYPE
          || getChangeData(change).elemID.typeName === SECURITY_LEVEL_TYPE
        )
    )

    // This code is meant to allow adding new levels with a new scheme (no scheme id yet).
    // Note that deploy is called in groups, so only 1 scheme (if it was changed) with
    // its changed levels
    const securitySchemeChange = relevantChanges
      .filter(isInstanceChange)
      .find(change => getChangeData(change).elemID.typeName === SECURITY_SCHEME_TYPE)

    const schemesDeployResult = securitySchemeChange !== undefined
      && isAdditionChange(securitySchemeChange)
      ? await deployChanges([securitySchemeChange],
        async change => {
          await defaultDeployChange({ change, client, apiDefinitions: DC_REDUCED_API_DEFINITIONS })
        })
      : {
        appliedChanges: [],
        errors: [],
      }

    if (schemesDeployResult.errors.length !== 0) {
      return {
        leftoverChanges,
        deployResult: schemesDeployResult,
      }
    }

    const levelsChanges = relevantChanges
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === SECURITY_LEVEL_TYPE)

    levelsChanges.forEach(change => {
      getChangeData(change).value.schemeId = securitySchemeChange !== undefined
        ? getChangeData(securitySchemeChange).value.id
        : getParents(getChangeData(change))[0].value.value.id
    })

    const deployResult = await deployChanges(
      levelsChanges.filter(isInstanceChange),
      async change => {
        await defaultDeployChange({ change, client, apiDefinitions: DC_REDUCED_API_DEFINITIONS })
      },
    )
    deployResult.appliedChanges = [
      ...deployResult.appliedChanges,
      ...schemesDeployResult.appliedChanges]
    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
