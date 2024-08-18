/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  AdditionChange,
  Change,
  ChangeDataType,
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  ModificationChange,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { getInstancesFromElementSource, getParentElemID, resolvePath } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'

const log = logger(module)

const { isDefined } = values

type Scope = 'global' | 'parent'
export const SCOPE: { [K in Scope]: K } = {
  global: 'global',
  parent: 'parent',
}

export type ScopeAndUniqueFields = {
  scope: Scope
  uniqueFields: string[]
}

type TypeInfo = {
  scope: Scope
  uniqueFieldNames: string[]
  changesOfType: (ModificationChange<InstanceElement> | AdditionChange<InstanceElement>)[]
  instancesOfType: InstanceElement[]
}

const createTypeToChangesRecord = (
  changes: readonly Change<ChangeDataType>[],
  typeToFieldRecord: Record<string, ScopeAndUniqueFields>,
): Record<string, (ModificationChange<InstanceElement> | AdditionChange<InstanceElement>)[]> => {
  const relevantChanges = changes
    .filter(isAdditionOrModificationChange)
    .filter(change => Object.prototype.hasOwnProperty.call(typeToFieldRecord, getChangeData(change).elemID.typeName))
    .filter(isInstanceChange)
  return _.groupBy(relevantChanges, change => getChangeData(change).elemID.typeName)
}

const createTypeToInstancesRecord = async (
  elementsSource: ReadOnlyElementsSource,
  relevantTypes: string[],
): Promise<Record<string, InstanceElement[]>> => {
  const instances = relevantTypes.length === 0 ? [] : await getInstancesFromElementSource(elementsSource, relevantTypes)
  return _.groupBy(instances, instance => instance.elemID.typeName)
}

const createTypeInfos = async (
  changes: readonly Change<ChangeDataType>[],
  elementsSource: ReadOnlyElementsSource,
  typeToFieldRecord: Record<string, ScopeAndUniqueFields>,
): Promise<TypeInfo[]> => {
  const typeToChangesRecord = createTypeToChangesRecord(changes, typeToFieldRecord)
  const relevantTypes = Object.keys(typeToChangesRecord)
  const typeToInstancesRecord = await createTypeToInstancesRecord(elementsSource, relevantTypes)
  return relevantTypes.map(typeName => ({
    scope: typeToFieldRecord[typeName].scope,
    uniqueFieldNames: typeToFieldRecord[typeName].uniqueFields,
    changesOfType: typeToChangesRecord[typeName],
    instancesOfType: typeToInstancesRecord[typeName],
  }))
}

const getFieldValueWithScope = (instance: InstanceElement, fieldName: string, scope: Scope): string | undefined => {
  const fieldValue = resolvePath(instance, instance.elemID.createNestedID(...fieldName.split('.')))
  if (!_.isString(fieldValue)) {
    log.warn('Unique field value is not a string')
    return undefined
  }
  return scope === SCOPE.parent ? `${getParentElemID(instance).getFullName()}.${fieldValue}` : fieldValue
}

const getErrorForChange = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  fieldNames: string[],
  fieldValueCount: Record<string, Record<string, number>>,
  scope: Scope,
): ChangeError | undefined => {
  const instance = getChangeData(change)
  const nonUniqueFieldValues = fieldNames.filter(fieldName => {
    const fieldValue = getFieldValueWithScope(instance, fieldName, scope)
    return fieldValue !== undefined && fieldValueCount[fieldName][fieldValue] > 1
  })
  if (nonUniqueFieldValues.length === 0) {
    return undefined
  }
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: `The ${fieldNames.length > 1 ? 'fields' : 'field'} ${fieldNames.map(str => `'${str}'`).join(', ')} in type ${instance.elemID.typeName} must have ${fieldNames.length > 1 ? 'unique values' : 'a unique value'}`,
    detailedMessage: `This instance cannot be deployed due to non unique values, within the ${scope} scope, in the following fields: ${nonUniqueFieldValues.map(str => `'${str}'`).join(', ')}.`,
  }
}

export const uniqueFieldsChangeValidatorCreator =
  (typeNameToUniqueFieldRecord: Record<string, ScopeAndUniqueFields>): ChangeValidator =>
  async (changes, elementsSource) => {
    if (elementsSource === undefined) {
      log.info("Didn't run unique fields validator as elementsSource is undefined")
      return []
    }
    return (await createTypeInfos(changes, elementsSource, typeNameToUniqueFieldRecord)).flatMap(typeInfo => {
      const { scope, uniqueFieldNames, changesOfType, instancesOfType } = typeInfo
      const fieldValueCount: Record<string, Record<string, number>> = {}
      uniqueFieldNames.forEach(fieldName => {
        const fieldValueToInstances = _.groupBy(instancesOfType, instance =>
          getFieldValueWithScope(instance, fieldName, scope),
        )
        fieldValueCount[fieldName] = _.mapValues(fieldValueToInstances, instances => instances.length)
      })
      return changesOfType
        .map(change => getErrorForChange(change, uniqueFieldNames, fieldValueCount, scope))
        .filter(isDefined)
    })
  }
