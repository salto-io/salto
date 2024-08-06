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
import { getInstancesFromElementSource, resolvePath } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'

const log = logger(module)

const { isDefined } = values

type TypeInfo = {
  changesOfType: (ModificationChange<InstanceElement> | AdditionChange<InstanceElement>)[]
  instancesOfType: InstanceElement[]
  uniqueFieldNames: string[]
}

const createTypeToChangesRecord = (
  changes: readonly Change<ChangeDataType>[],
  typeToFieldRecord: Record<string, string[]>,
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
  typeToFieldRecord: Record<string, string[]>,
): Promise<TypeInfo[]> => {
  const typeToChangesRecord = createTypeToChangesRecord(changes, typeToFieldRecord)
  const relevantTypes = Object.keys(typeToChangesRecord)
  const typeToInstancesRecord = await createTypeToInstancesRecord(elementsSource, relevantTypes)
  return relevantTypes.map(typeName => ({
    changesOfType: typeToChangesRecord[typeName],
    instancesOfType: typeToInstancesRecord[typeName],
    uniqueFieldNames: typeToFieldRecord[typeName],
  }))
}

const getFieldValue = (instance: InstanceElement, fieldName: string): string | undefined => {
  const fieldValue = resolvePath(instance, instance.elemID.createNestedID(...fieldName.split('.')))
  if (!_.isString(fieldValue)) {
    log.warn('Unique field value is not a string')
    return undefined
  }
  return fieldValue
}

const getErrorForChange = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  fieldNames: string[],
  fieldValueCount: Record<string, Record<string, number>>,
): ChangeError | undefined => {
  const changeData = getChangeData(change)
  const nonUniqueFieldValues = fieldNames.filter(fieldName => {
    const fieldValue = getFieldValue(changeData, fieldName)
    return fieldValue !== undefined && fieldValueCount[fieldName][fieldValue] > 1
  })
  if (nonUniqueFieldValues.length === 0) {
    return undefined
  }
  return {
    elemID: changeData.elemID,
    severity: 'Error',
    message: `The ${fieldNames.length > 1 ? 'fields' : 'field'} ${fieldNames.map(str => `'${str}'`).join(',')} in type ${changeData.elemID.typeName} must have ${fieldNames.length > 1 ? 'unique values' : 'a unique value'}`,
    detailedMessage: `This instance cannot be deployed due to non unique values in the following fields: ${nonUniqueFieldValues.join(',')}.`,
  }
}

export const uniqueFieldsChangeValidatorCreator =
  (typeNameToUniqueFieldRecord: Record<string, string[]>): ChangeValidator =>
  async (changes, elementsSource) => {
    if (elementsSource === undefined) {
      log.info("Didn't run unique fields validator as elementsSource is undefined")
      return []
    }
    return (await createTypeInfos(changes, elementsSource, typeNameToUniqueFieldRecord)).flatMap(typeInfo => {
      const { changesOfType, instancesOfType, uniqueFieldNames } = typeInfo
      const fieldValueCount: Record<string, Record<string, number>> = {}
      uniqueFieldNames.forEach(fieldName => {
        const fieldValueToInstances = _.groupBy(instancesOfType, instance => getFieldValue(instance, fieldName))
        fieldValueCount[fieldName] = _.mapValues(fieldValueToInstances, instances => instances.length)
      })
      return changesOfType.map(change => getErrorForChange(change, uniqueFieldNames, fieldValueCount)).filter(isDefined)
    })
  }
