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
import {
  AdditionChange,
  BuiltinTypes,
  Change,
  ChangeDataType,
  CORE_ANNOTATIONS,
  Field,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
  isReferenceExpression,
  ListType,
  MapType,
  ModificationChange,
  ReferenceExpression,
  Value,
  Values,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { naclCase } from '@salto-io/adapter-utils'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { FilterCreator } from '../../filter'
import JiraClient from '../../client/client'
import { JiraConfig } from '../../config/config'
import { deployTabs, SCREEN_TAB_TYPE_NAME } from './screenable_tab'
import { findObject } from '../../utils'

const { awu } = collections.asynciterable
const log = logger(module)

const SCREEN_TYPE_NAME = 'Screen'

const deployTabsOrder = async (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const tabsAfter = _(change.data.after.value.tabs)
    .values()
    .sortBy(tab => tab.position)
    .map(tab => tab.id)
    .value()

  const tabsBefore = isModificationChange(change)
    ? _(change.data.before.value.tabs)
        .values()
        .sortBy(tab => tab.position)
        .map(tab => tab.id)
    : []

  if (tabsAfter.length <= 1 || _.isEqual(tabsAfter, tabsBefore)) {
    return
  }

  const instance = getChangeData(change)
  // This has to be sequential because when you re-position a tab from X to 0,
  // all the positions of the tabs between 0 and X are incremented by 1
  await awu(tabsAfter).forEach((id, index) =>
    client.post({
      url: `/rest/api/3/screens/${instance.value.id}/tabs/${id}/move/${index}`,
      data: {},
    }),
  )
}

const deployScreen = async (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  const nameAfter = change.data.after.value.name
  const nameBefore = isModificationChange(change) ? change.data.before.value.name : undefined
  await defaultDeployChange({
    change,
    client,
    apiDefinitions: config.apiDefinitions,
    fieldsToIgnore:
      nameAfter === nameBefore
        ? // If we try to deploy a screen with the same name,
          // we get an error that the name is already in use
          ['tabs', 'name']
        : ['tabs'],
  })
  await deployTabs(change, client, config)
  await deployTabsOrder(change, client)
}

const filter: FilterCreator = ({ config, client }) => ({
  name: 'screenFilter',
  onFetch: async elements => {
    const screenType = findObject(elements, SCREEN_TYPE_NAME)
    const screenTabType = findObject(elements, SCREEN_TAB_TYPE_NAME)

    if (screenType !== undefined && screenTabType !== undefined) {
      screenType.fields.tabs = new Field(screenType, 'tabs', new MapType(screenTabType), {
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      screenTabType.fields.fields = new Field(screenTabType, 'fields', new ListType(BuiltinTypes.STRING), {
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
      screenTabType.fields.originalFieldsIds = new Field(
        screenTabType,
        'originalFieldsIds',
        // I used this Map because a regular List did not work with hidden_value
        new MapType(new ListType(BuiltinTypes.STRING)),
        { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      )
    }

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === SCREEN_TYPE_NAME)
      .forEach(element => {
        element.value.tabs =
          element.value.tabs &&
          _.keyBy(
            element.value.tabs.map((tab: Values, position: number) => {
              const fieldIds = tab.fields && tab.fields.map((field: Values) => field.id)
              log.debug(
                `add to ScreenTab "${tab.name}" in the Screen "${element.value.name}" originalFieldsIds: ${fieldIds}`,
              )
              return {
                ...tab,
                fields: fieldIds,
                // in screen filter we may remove the beforeInstance screenTab fields,
                // a field might be a missing reference so we need to save its original id
                originalFieldsIds: { ids: fieldIds },
                position,
              }
            }),
            tab => naclCase(tab.name),
          )
      })
  },
  preDeploy: async (changes: Change<ChangeDataType>[]) => {
    changes
      .filter(isInstanceChange)
      .filter(isModificationChange)
      .filter(change => getChangeData(change).elemID.typeName === SCREEN_TYPE_NAME)
      .filter(change => !_.isEmpty(change.data.before.value.tabs))
      .forEach(change => {
        Object.values(change.data.before.value.tabs).forEach((tab: Value): void => {
          if (tab.originalFieldsIds?.ids) {
            tab.fields = tab.originalFieldsIds.ids
          } else {
            // this should not happen if there are fields in the tab
            log.warn(
              `ScreenTab "${tab.name}" in the Screen "${change.data.before.value.name}" has no originalFieldsIds`,
            )
          }
        })
      })
  },
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) &&
        isAdditionOrModificationChange(change) &&
        getChangeData(change).elemID.typeName === SCREEN_TYPE_NAME,
    )

    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange).filter(isAdditionOrModificationChange),
      async change => deployScreen(change, client, config),
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
  onDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(change => getChangeData(change))
      .filter(instance => instance.elemID.typeName === SCREEN_TYPE_NAME)
      .filter(instance => !_.isEmpty(instance.value.tabs))
      .forEach(instance => {
        Object.values(instance.value.tabs).forEach((tab: Value): void => {
          if (tab.fields) {
            tab.originalFieldsIds = {
              ids: tab.fields.map((refOrFieldId: ReferenceExpression | string) =>
                isReferenceExpression(refOrFieldId) ? refOrFieldId.value.value.id : refOrFieldId,
              ),
            }
          } else {
            tab.originalFieldsIds = {
              ids: [],
            }
          }
        })
      })
  },
})

export default filter
