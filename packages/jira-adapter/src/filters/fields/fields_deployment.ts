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
import { Change, Element, getChangeData, InstanceElement, isInstanceChange, isObjectType, isRemovalChange, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterContext } from '../../config'
import JiraClient from '../../client/client'
import { FilterCreator } from '../../filter'
import { deployContexts, setContextDeploymentAnnotations } from './contexts'
import { updateDefaultValues } from './default_values'
import { deployChange, deployChanges } from '../../deployment'

const deployField = async (
  change: Change<InstanceElement>,
  client: JiraClient,
  config: FilterContext): Promise<void> => {
  await deployChange(change, client, config.apiDefinitions, ['contexts'])

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
    const fieldType = elements.find(e => isObjectType(e) && e.elemID.name === 'Field') as ObjectType | undefined
    if (fieldType !== undefined) {
      await setContextDeploymentAnnotations(fieldType)
    }
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === 'Field'
    )

    const deployResult = await deployChanges(
      relevantChanges as Change<InstanceElement>[],
      change => deployField(change, client, config)
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
