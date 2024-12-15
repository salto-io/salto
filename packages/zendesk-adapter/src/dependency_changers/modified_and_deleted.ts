/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  dependencyChange,
  DependencyChange,
  DependencyChanger,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isModificationChange,
  isReferenceExpression,
  isRemovalChange,
  ModificationChange,
} from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { deployment, references as referencesUtils } from '@salto-io/adapter-components'
import _, { isArray } from 'lodash'
import { MACRO_TYPE_NAME, TICKET_FIELD_TYPE_NAME, TRIGGER_CATEGORY_TYPE_NAME, TRIGGER_TYPE_NAME } from '../constants'

const { isDefined } = lowerDashValues
const { MISSING_REF_PREFIX } = referencesUtils

type GetDeletedTypeFullNameFromModificationChangeFunc = (
  change: ModificationChange<InstanceElement>,
  type: 'before' | 'after',
) => string[]
type DeletedDependency = {
  typeName: string
  getDeletedTypeFullNameFromModificationChangeFunc: GetDeletedTypeFullNameFromModificationChangeFunc
}

const getFieldFromField = (arr: unknown): string[] => {
  if (!isArray(arr)) {
    return []
  }
  return arr
    .map(obj => obj.field)
    .filter(field => isReferenceExpression(field))
    .filter(field => field.elemID.typeName === TICKET_FIELD_TYPE_NAME)
    .filter(ref => !ref.elemID.name.startsWith(MISSING_REF_PREFIX))
    .map(ref => ref.elemID.getFullName())
}

const getFieldsFromMacro = (change: ModificationChange<InstanceElement>, type: 'before' | 'after'): string[] => {
  const data = change.data[type]
  const actions = data.value.actions ?? []
  return getFieldFromField(actions)
}

const getCategoryFromtrigger = (change: ModificationChange<InstanceElement>, type: 'before' | 'after'): string[] => {
  const data = change.data[type]
  const category = data.value.category_id
  if (!isReferenceExpression(category)) {
    return []
  }
  if (category.elemID.name.startsWith(MISSING_REF_PREFIX)) {
    return []
  }
  return [category.elemID.getFullName()]
}

const getFieldsFromTrigger = (change: ModificationChange<InstanceElement>, type: 'before' | 'after'): string[] => {
  const data = change.data[type]
  const conditions = data.value.conditions ?? {}
  const conditionsAll = conditions.all ?? []
  const conditionsAny = conditions.any ?? []

  const conditionAllFields = getFieldFromField(conditionsAll)
  const conditionAnyFields = getFieldFromField(conditionsAny)
  return conditionAnyFields.concat(conditionAllFields)
}

const dependencyTuple: Record<string, DeletedDependency[]> = {
  [MACRO_TYPE_NAME]: [
    {
      typeName: TICKET_FIELD_TYPE_NAME,
      getDeletedTypeFullNameFromModificationChangeFunc: getFieldsFromMacro,
    },
  ],
  [TRIGGER_TYPE_NAME]: [
    {
      typeName: TRIGGER_CATEGORY_TYPE_NAME,
      getDeletedTypeFullNameFromModificationChangeFunc: getCategoryFromtrigger,
    },
    {
      typeName: TICKET_FIELD_TYPE_NAME,
      getDeletedTypeFullNameFromModificationChangeFunc: getFieldsFromTrigger,
    },
  ],
}

const getNameFromChange = (change: deployment.dependency.ChangeWithKey<Change<InstanceElement>>): string =>
  getChangeData(change.change).elemID.getFullName()

const getDependencies = ({
  changes,
  modificationTypeName,
  deletedTypeName,
  getDeletedTypeFullNameFromModificationChangeFunc,
}: {
  changes: deployment.dependency.ChangeWithKey<Change<InstanceElement>>[]
  modificationTypeName: string
  deletedTypeName: string
  getDeletedTypeFullNameFromModificationChangeFunc: (
    change: ModificationChange<InstanceElement>,
    type: 'before' | 'after',
  ) => string[]
}): DependencyChange[] => {
  const modificationChanges = changes.filter(
    change =>
      getChangeData(change.change).elemID.typeName === modificationTypeName && isModificationChange(change.change),
  )
  const deletionChange = changes.filter(
    change => getChangeData(change.change).elemID.typeName === deletedTypeName && isRemovalChange(change.change),
  )

  const deletedElemIdToChange = _.keyBy(deletionChange, getNameFromChange)
  return modificationChanges
    .flatMap(change => {
      const changeData = change.change
      if (!isModificationChange(changeData)) {
        // shouldn't happen, only for typescript
        return undefined
      }

      const beforeDeletedTypeFullNames = getDeletedTypeFullNameFromModificationChangeFunc(changeData, 'before')
      const afterDeletedTypeFullNames = getDeletedTypeFullNameFromModificationChangeFunc(changeData, 'after')

      const removedInstanceFullName = _.difference(beforeDeletedTypeFullNames, afterDeletedTypeFullNames)

      const newDependency = removedInstanceFullName
        .map(name => {
          if (deletedElemIdToChange[name] !== undefined) {
            return dependencyChange('add', deletedElemIdToChange[name].key, change.key)
          }
          return undefined
        })
        .filter(isDefined)

      return newDependency
    })
    .filter(isDefined)
}

/**
 * This dependency changer is used to creates dependencies between modified instances and deleted instances
 * when the modified instance had a reference to the deleted instance.
 * This will make the modified instance to be deployed first and then the deleted instance. avoiding errors such as
 * "Field cannot be deleted because it is still in use by:"
 */
export const modifiedAndDeletedDependencyChanger: DependencyChanger = async changes => {
  const potentialChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
      isInstanceChange(change.change),
    )
  return Object.entries(dependencyTuple).flatMap(([modificationTypeName, deletedDependencyArray]) =>
    deletedDependencyArray.flatMap(({ typeName: deletedTypeName, getDeletedTypeFullNameFromModificationChangeFunc }) =>
      getDependencies({
        changes: potentialChanges,
        modificationTypeName,
        deletedTypeName,
        getDeletedTypeFullNameFromModificationChangeFunc,
      }),
    ),
  )
}
