/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  dependencyChange,
  DependencyChanger,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FIELD_CONFIGURATION_TYPE_NAME } from '../constants'
import { FIELD_TYPE_NAME } from '../filters/fields/constants'

export const fieldConfigurationDependencyChanger: DependencyChanger = async changes => {
  const fieldConfigChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(
      change =>
        isInstanceChange(change.change) &&
        isAdditionOrModificationChange(change.change) &&
        getChangeData(change.change).elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME,
    )

  const fieldAdditionChanges = _(Array.from(changes.entries()))
    .map(([key, change]) => ({ key, change }))
    .filter(
      change =>
        isInstanceChange(change.change) &&
        isAdditionChange(change.change) &&
        getChangeData(change.change).elemID.typeName === FIELD_TYPE_NAME,
    )
    .keyBy(change => getChangeData(change.change).elemID.name)
    .value()

  const fieldRemovalChanges = _(Array.from(changes.entries()))
    .map(([key, change]) => ({ key, change }))
    .filter(
      change =>
        isInstanceChange(change.change) &&
        isRemovalChange(change.change) &&
        getChangeData(change.change).elemID.typeName === FIELD_TYPE_NAME,
    )
    .keyBy(change => getChangeData(change.change).elemID.name)
    .value()

  return fieldConfigChanges.flatMap(fieldConfigChange => {
    const fieldConfigInstance = getChangeData(fieldConfigChange.change)
    if (!isInstanceElement(fieldConfigInstance) || _.isEmpty(fieldConfigInstance.value.fields)) {
      return []
    }

    const additionDeps = Object.keys(fieldConfigInstance.value.fields)
      .map(key => fieldAdditionChanges[key])
      .filter(values.isDefined)
      .map(additionChange => dependencyChange('add', fieldConfigChange.key, additionChange.key))

    const removalDeps = Object.keys(fieldConfigInstance.value.fields)
      .map(key => fieldRemovalChanges[key])
      .filter(values.isDefined)
      .map(removalChange => dependencyChange('add', removalChange.key, fieldConfigChange.key))

    return additionDeps.concat(removalDeps)
  })
}
