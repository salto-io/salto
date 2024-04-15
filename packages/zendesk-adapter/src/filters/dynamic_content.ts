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
import {
  Change,
  DeployResult,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isModificationChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { addIdsToChildrenUponAddition, deployChange, deployChanges, deployChangesByGroups } from '../deployment'
import { API_DEFINITIONS_CONFIG } from '../config'
import { applyforInstanceChangesOfType, placeholderToName, nameToPlaceholder } from './utils'
import { DYNAMIC_CONTENT_ITEM_TYPE_NAME } from '../constants'

const log = logger(module)

export const VARIANTS_FIELD_NAME = 'variants'
export const DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME = 'dynamic_content_item__variants'

const { makeArray } = collections.array

const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'dynamicContentFilter',
  preDeploy: async (changes: Change<InstanceElement>[]) => {
    const localeIdToVariant = Object.fromEntries(
      changes
        .filter(change => getChangeData(change).elemID.typeName === DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME)
        .map(getChangeData)
        .map(variant => [variant.value.locale_id, variant.value]),
    )
    await applyforInstanceChangesOfType(
      changes.filter(isAdditionChange),
      [DYNAMIC_CONTENT_ITEM_TYPE_NAME],
      (instance: InstanceElement) => {
        instance.value[VARIANTS_FIELD_NAME] = makeArray(instance.value[VARIANTS_FIELD_NAME])
          .map(variant => localeIdToVariant[variant])
          .filter(values.isDefined)
        return instance
      },
    )
  },
  onDeploy: async (changes: Change<InstanceElement>[]) => {
    await applyforInstanceChangesOfType(
      changes.filter(isAdditionChange),
      [DYNAMIC_CONTENT_ITEM_TYPE_NAME],
      (instance: InstanceElement) => {
        instance.value[VARIANTS_FIELD_NAME] = makeArray(instance.value[VARIANTS_FIELD_NAME])
          .map(variant => variant.locale_id)
          .filter(values.isDefined)
        return instance
      },
    )
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [relevantChanges, leftoverChanges] = _.partition(changes, change =>
      [DYNAMIC_CONTENT_ITEM_TYPE_NAME, DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME].includes(
        getChangeData(change).elemID.typeName,
      ),
    )
    const [itemChanges, variantChanges] = _.partition(
      relevantChanges,
      change => getChangeData(change).elemID.typeName === DYNAMIC_CONTENT_ITEM_TYPE_NAME,
    )

    const isAdditionOfAlteredDynamicContentItem = (item: Change<InstanceElement>): boolean =>
      isAdditionChange(item) &&
      getChangeData(item).value.placeholder !== nameToPlaceholder(getChangeData(item).value.title)

    const alterDynamicContentAddition = async (change: Change<InstanceElement>): Promise<DeployResult> => {
      const changeData = getChangeData(change)
      const newAdditionChange = changeData.clone()
      const newModificationChange = newAdditionChange.clone()
      newAdditionChange.value.name = placeholderToName(newModificationChange.value.placeholder)
      try {
        log.debug('Creating dynamic content item with placeholder %s', newAdditionChange.value.placeholder)
        await deployChange({ action: 'add', data: { after: newAdditionChange } }, client, config.apiDefinitions)
      } catch (additionError) {
        return {
          appliedChanges: [],
          errors: [
            {
              elemID: changeData.elemID,
              message: `Failed to create dynamic content item: ${additionError}`,
              severity: 'Error',
            },
          ],
        }
      }
      try {
        await deployChange(
          { action: 'modify', data: { before: newAdditionChange, after: newModificationChange } },
          client,
          config.apiDefinitions,
        )
      } catch (modificationError) {
        try {
          await deployChange({ action: 'remove', data: { before: newAdditionChange } }, client, config.apiDefinitions)
        } catch (removalError) {
          log.error('Unable to remove dynamic content item after failed modification: %s', removalError)
          return {
            appliedChanges: [],
            errors: [
              {
                elemID: changeData.elemID,
                message: 'Unable to modify name of dynamic content item, please modify it in the Zendesk UI and fetch.',
                severity: 'Warning',
              },
            ],
          }
        }
        log.warn('Unable to modify dynamic content item %s, but removal was successful: %s', modificationError)
        return {
          appliedChanges: [],
          errors: [{ message: `Failed to create dynamic content item: ${modificationError}`, severity: 'Error' }],
        }
      }
      log.trace('Successfully created dynamic content item %s', changeData.elemID.name)
      return { appliedChanges: [change], errors: [] }
    }

    if (itemChanges.length === 0 || itemChanges.every(isModificationChange)) {
      // The service does not allow us to have an item with no variant - therefore, we need to do
      // the removal changes last. Variant additions need to be first in order to prevent race
      // conditions with item modifications
      const [variantAdditionChanges, variantNonAdditionChanges] = _.partition(variantChanges, isAdditionChange)
      const [variantRemovalChanges, variantModificationChanges] = _.partition(
        variantNonAdditionChanges,
        isRemovalChange,
      )
      const [itemRemovalChanges, itemNonRemovalChanges] = _.partition(itemChanges, isRemovalChange)

      const deployResult = await deployChangesByGroups(
        [
          variantAdditionChanges,
          itemNonRemovalChanges,
          variantModificationChanges,
          itemRemovalChanges,
          variantRemovalChanges,
        ] as Change<InstanceElement>[][],
        async change => {
          if (isAdditionOfAlteredDynamicContentItem(change)) {
            await alterDynamicContentAddition(change)
          }
          await deployChange(change, client, config.apiDefinitions)
        },
      )
      return { deployResult, leftoverChanges }
    }
    const deployResult = await deployChanges(itemChanges, async change => {
      const response = await deployChange(change, client, config.apiDefinitions)
      return addIdsToChildrenUponAddition({
        response,
        parentChange: change,
        childrenChanges: variantChanges,
        apiDefinitions: config[API_DEFINITIONS_CONFIG],
        childFieldName: VARIANTS_FIELD_NAME,
        childUniqueFieldName: 'locale_id',
      })
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
