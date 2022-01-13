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
import { AdditionChange, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, isModificationChange, ModificationChange, ReferenceExpression } from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { defaultDeployChange, deployChanges } from '../../deployment'
import { FilterCreator } from '../../filter'
import JiraClient from '../../client/client'
import { JiraConfig } from '../../config'
import { covertFields } from './fields'
import { findObject, setDeploymentAnnotations } from '../../utils'

const { awu } = collections.asynciterable

const SCREEN_TYPE_NAME = 'Screen'

const verifyTabsResolved = (
  instance: InstanceElement
): void => instance.value.tabs?.forEach((tab: ReferenceExpression, index: number) => {
  if (tab.value === undefined) {
    throw new Error(`Received unresolved reference in tab ${index} of ${instance.elemID.getFullName()}`)
  }
})


const deployTabsOrder = async (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient
): Promise<void> => {
  verifyTabsResolved(change.data.after)
  const tabsAfter = change.data.after.value.tabs
    ?.map((tab: ReferenceExpression) => tab.value.value.id) ?? []

  if (isModificationChange(change)) {
    verifyTabsResolved(change.data.before)
  }
  const tabsBefore = isModificationChange(change)
    ? change.data.before.value.tabs?.map((tab: ReferenceExpression) => tab.value.value.id) ?? []
    : []

  if (tabsAfter.length <= 1 || _.isEqual(tabsAfter, tabsBefore)) {
    return
  }

  const instance = getChangeData(change)
  // This has to be sequential because when you re-position a tab from X to 0,
  // all the positions of the tabs between 0 and X are incremented by 1
  await awu(tabsAfter).forEach(
    (id, index) => client.post({
      url: `/rest/api/3/screens/${instance.value.id}/tabs/${id}/move/${index}`,
      data: {},
    })
  )
}

const deployScreen = async (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient,
  config: JiraConfig
): Promise<void> => {
  const nameAfter = change.data.after.value.name
  const nameBefore = isModificationChange(change)
    ? change.data.before.value.name
    : undefined
  await defaultDeployChange({
    change,
    client,
    apiDefinitions: config.apiDefinitions,
    fieldsToIgnore: nameAfter === nameBefore
      // If we try to deploy a screen with the same name,
      // we get an error that the name is already in use
      ? ['tabs', 'name']
      : ['tabs'],
  })

  await deployTabsOrder(change, client)
}

const filter: FilterCreator = ({ config, client }) => ({
  onFetch: async elements => {
    const screenType = findObject(elements, SCREEN_TYPE_NAME)
    if (screenType !== undefined) {
      setDeploymentAnnotations(screenType, 'tabs')
    }

    covertFields(elements, SCREEN_TYPE_NAME, 'availableFields')
  },
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isAdditionOrModificationChange(change)
        && getChangeData(change).elemID.typeName === SCREEN_TYPE_NAME
    )


    const deployResult = await deployChanges(
      relevantChanges
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange),
      async change => deployScreen(
        change,
        client,
        config
      )
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
