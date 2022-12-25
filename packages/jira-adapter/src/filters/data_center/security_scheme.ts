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
import { Change, getChangeData, InstanceElement, isInstanceChange } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { objects } from '@salto-io/lowerdash'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { SECURITY_LEVEL_TYPE, SECURITY_SCHEME_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'

/**
 * Filter to support deploy in DC, helps sets the scheme id before creating levels, and set the default level
 */
const filter: FilterCreator = ({ client, config }) => ({
  deploy: async changes => {
    if (!client.isDataCenter) {
      return {
        leftoverChanges: changes,
        deployResult: {
          appliedChanges: [],
          errors: [],
        },
      }
    }
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && (
          getChangeData(change).elemID.typeName === SECURITY_SCHEME_TYPE
          || getChangeData(change).elemID.typeName === SECURITY_LEVEL_TYPE
        )
    )

    const securitySchemeChange = relevantChanges
      .filter(isInstanceChange)
      .find(change => getChangeData(change).elemID.typeName === SECURITY_SCHEME_TYPE)

    const schemesDeployResult = securitySchemeChange !== undefined
      ? await deployChanges(
        [securitySchemeChange] as Change<InstanceElement>[],
        async change => {
          await defaultDeployChange({
            change,
            client,
            apiDefinitions: config.apiDefinitions,
            // fieldsToIgnore: [
            //   'defaultLevel',
            //   'levels',
            // ],
          })
        }
      )
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

    const levelsDeployResult = levelsChanges !== undefined
      ? await deployChanges(
        levelsChanges as Change<InstanceElement>[],
        async change => {
          await defaultDeployChange({
            change,
            client,
            apiDefinitions: config.apiDefinitions,
          })
        }
      )
      : {
        appliedChanges: [],
        errors: [],
      }

    return {
      leftoverChanges,
      deployResult: objects.concatObjects([schemesDeployResult, levelsDeployResult]),
    }
  },
})

export default filter
