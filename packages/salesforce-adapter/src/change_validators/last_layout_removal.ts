/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isInstanceElement,
  isObjectTypeChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { apiName } from '../transformers/transformer'
import { LAYOUT_TYPE_ID_METADATA_TYPE } from '../constants'
import { isInstanceOfType, isInstanceOfTypeChange } from '../filters/utils'

const { awu, keyByAsync, groupByAsync } = collections.asynciterable

const getObjectName = async (layoutInstance: InstanceElement): Promise<string> =>
  (await apiName(layoutInstance)).split('-')[0]

const createLastLayoutDeletionError = ({ elemID }: InstanceElement, objectName: string): ChangeError => ({
  elemID,
  severity: 'Error',
  message: 'Custom objects must have at least one layout',
  detailedMessage: `Current deployment plan attempts to delete all custom object ${objectName} layouts. Please make sure to have at least one layout in order to deploy.`,
})

const changeValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    return []
  }

  const relevantChanges = await awu(changes)
    .filter(isInstanceChange)
    .filter(isRemovalChange)
    .filter(isInstanceOfTypeChange(LAYOUT_TYPE_ID_METADATA_TYPE))
    .toArray()

  if (_.isEmpty(relevantChanges)) {
    return []
  }

  const removedObjectNames = Object.keys(
    await keyByAsync(await awu(changes).filter(isObjectTypeChange).filter(isRemovalChange).toArray(), change =>
      apiName(getChangeData(change)),
    ),
  )

  const relevantChangesByObjectName = _.pickBy(
    await groupByAsync(relevantChanges, change => getObjectName(getChangeData(change))),
    // If the Object is fully removed, it's a valid change.
    (_value, objectName) => !removedObjectNames.includes(objectName),
  )

  const objectsWithRemainingLayouts = Object.keys(
    await groupByAsync(
      await awu(await elementsSource.getAll())
        .filter(isInstanceElement)
        .filter(isInstanceOfType(LAYOUT_TYPE_ID_METADATA_TYPE))
        .toArray(),
      getObjectName,
    ),
  )

  return Object.entries(relevantChangesByObjectName)
    .filter(([objectName]) => !objectsWithRemainingLayouts.includes(objectName))
    .flatMap(([objectName, deletedLayoutChanges]) =>
      deletedLayoutChanges.map(getChangeData).map(instance => createLastLayoutDeletionError(instance, objectName)),
    )
}

export default changeValidator
