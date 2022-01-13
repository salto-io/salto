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
import { Change, Element, getChangeData, InstanceElement, isInstanceChange, isObjectType, isRemovalChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import JiraClient from '../../client/client'
import { FilterCreator } from '../../filter'
import { deployContexts, setContextDeploymentAnnotations } from './contexts'
import { updateDefaultValues } from './default_values'
import { defaultDeployChange, deployChanges } from '../../deployment'
import { FIELD_TYPE_NAME } from './constants'
import { JiraConfig } from '../../config'


const deployField = async (
  change: Change<InstanceElement>,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  await defaultDeployChange({ change, client, apiDefinitions: config.apiDefinitions, fieldsToIgnore: ['contexts'] })

  if (isRemovalChange(change)) {
    return
  }

  await deployContexts(
    change,
    client,
    config.apiDefinitions
  )
  await updateDefaultValues(change, client)
}

const filter: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]) => {
    const fieldType = elements.filter(isObjectType).find(e => e.elemID.name === FIELD_TYPE_NAME)
    if (fieldType !== undefined) {
      await setContextDeploymentAnnotations(fieldType)
    }
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === FIELD_TYPE_NAME
    )

    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange),
      change => deployField(change, client, config)
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
