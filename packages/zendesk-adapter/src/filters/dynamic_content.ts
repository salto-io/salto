/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Change,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isModificationChange,
  isRemovalChange,
  isSaltoError,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { deployment } from '@salto-io/adapter-components'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { addId, addIdsToChildrenUponAddition, deployChange, deployChanges, deployChangesByGroups } from '../deployment'
import { applyforInstanceChangesOfType } from './utils'
import { DYNAMIC_CONTENT_ITEM_TYPE_NAME } from '../constants'

const log = logger(module)

export const VARIANTS_FIELD_NAME = 'variants'
export const DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME = 'dynamic_content_item__variants'

const { makeArray } = collections.array

const filterCreator: FilterCreator = ({ oldApiDefinitions, client, definitions }) => ({
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

    // {{dc.name}} -> name
    const placeholderToName = (placeholder: string): string => placeholder.substring(5, placeholder.length - 2)

    // name -> {{dc.name}}
    const nameToPlaceholder = (name: string): string => `{{dc.${name}}}`

    const isAdditionOfAlteredDynamicContentItem = (change: Change<InstanceElement>): boolean =>
      isAdditionChange(change) &&
      getChangeData(change).elemID.typeName === DYNAMIC_CONTENT_ITEM_TYPE_NAME &&
      getChangeData(change).value.placeholder !== nameToPlaceholder(getChangeData(change).value.name)

    // When adding a dynamic content item, Zendesk always takes the name and creates the placeholder using it, disregarding what we give it.
    //  This means that if we want to add a dynamic content item with a placeholder that is different from the name,
    //  we need to first add the item with a placeholder that is the same as the name, and then modify it to have the
    //  desired placeholder.
    const alterDynamicContentAddition = async (change: Change<InstanceElement>): Promise<deployment.ResponseResult> => {
      const clonedAdditionChange = await applyFunctionToChangeData(change, inst => inst.clone())
      const clonedChangeData = getChangeData(clonedAdditionChange)
      const newPlaceholder = clonedChangeData.value.placeholder
      clonedChangeData.value.name = placeholderToName(newPlaceholder)
      log.trace('Creating dynamic content item with placeholder %s', newPlaceholder)
      // addition change
      const response = await deployChange({
        change: clonedAdditionChange,
        client,
        apiDefinitions: oldApiDefinitions,
        definitions,
      })
      log.trace('Successfully created dynamic content item with placeholder %o', newPlaceholder)

      // must add ID before the modification change
      addId({ response, change: clonedAdditionChange, definitions })
      const afterChangeData = getChangeData(change)
      afterChangeData.value.id = getChangeData(clonedAdditionChange).value.id
      try {
        // modification change
        const result = await deployChange({
          change: { action: 'modify', data: { before: clonedChangeData, after: getChangeData(change) } },
          client,
          apiDefinitions: oldApiDefinitions,
          definitions,
        })
        log.trace('Successfully created dynamic content item %o', clonedChangeData.elemID.getFullName())
        return result
      } catch (modificationError) {
        // removal of failed modification
        try {
          await deployChange({
            change: { action: 'remove', data: { before: clonedChangeData } },
            client,
            apiDefinitions: oldApiDefinitions,
            definitions,
          })
          log.warn(
            'Unable to modify dynamic content item %s, but removal was successful: %o',
            clonedChangeData.elemID.getFullName(),
            modificationError,
          )
          return {
            message: `Failed to create dynamic content item: ${(modificationError as Error).message}`,
            severity: 'Error',
          }
        } catch (removalError) {
          log.error(
            'Unable to remove dynamic content item %s after failed modification: %o',
            clonedChangeData.elemID.getFullName(),
            removalError,
          )
          return {
            message:
              'Unable to modify name of dynamic content item, please modify it in the Zendesk UI and fetch with regenerate salto ids.',
            severity: 'Warning',
          }
        }
      }
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
          await deployChange({
            change,
            client,
            apiDefinitions: oldApiDefinitions,
            definitions,
          })
        },
      )
      return { deployResult, leftoverChanges }
    }
    const deployResult = await deployChanges(itemChanges, async change => {
      const response = isAdditionOfAlteredDynamicContentItem(change)
        ? await alterDynamicContentAddition(change)
        : await deployChange({
            change,
            client,
            apiDefinitions: oldApiDefinitions,
            definitions,
          })
      if (isSaltoError(response)) {
        throw response
      }
      return addIdsToChildrenUponAddition({
        response,
        parentChange: change,
        childrenChanges: variantChanges,
        apiDefinitions: oldApiDefinitions,
        definitions,
        childFieldName: VARIANTS_FIELD_NAME,
        childUniqueFieldName: 'locale_id',
      })
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
