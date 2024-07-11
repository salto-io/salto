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
  SeverityLevel,
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
  uniqueFieldName: string
}

const getSameUniqueFieldError = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  otherInstance: InstanceElement,
  fieldName: string,
): ChangeError => ({
  elemID: getChangeData(change).elemID,
  severity: 'Error' as SeverityLevel,
  message: `The field '${fieldName}' in type ${otherInstance.elemID.typeName} must have a unique value`,
  detailedMessage: `This ${otherInstance.elemID.typeName} have the same '${fieldName}' as the instance ${otherInstance.elemID.getFullName()}, and can not be deployed.`,
})

const getInstances = async (
  elementSource: ReadOnlyElementsSource | undefined,
  typeNames: string[],
): Promise<InstanceElement[]> =>
  elementSource === undefined || typeNames.length === 0 ? [] : getInstancesFromElementSource(elementSource, typeNames)

const getRelevantChanges = (
  changes: readonly Change<ChangeDataType>[],
  typeToFieldRecord: Record<string, string>,
): (ModificationChange<InstanceElement> | AdditionChange<InstanceElement>)[] =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(change => Object.prototype.hasOwnProperty.call(typeToFieldRecord, getChangeData(change).elemID.typeName))
    .filter(isInstanceChange)

const createTypeToChangesRecord = (
  changes: readonly Change<ChangeDataType>[],
  typeToFieldRecord: Record<string, string>,
): Record<string, (ModificationChange<InstanceElement> | AdditionChange<InstanceElement>)[]> => {
  const relevantChanges = getRelevantChanges(changes, typeToFieldRecord)
  return _.groupBy(relevantChanges, change => getChangeData(change).elemID.typeName)
}

const createTypeToInstancesRecord = async (
  elementsSource: ReadOnlyElementsSource | undefined,
  relevantTypes: string[],
): Promise<Record<string, InstanceElement[]>> => {
  const instances = await getInstances(elementsSource, relevantTypes)
  return _.groupBy(instances, instance => instance.elemID.typeName)
}

const createTypeInfos = async (
  changes: readonly Change<ChangeDataType>[],
  elementsSource: ReadOnlyElementsSource | undefined,
  typeToFieldRecord: Record<string, string>,
): Promise<TypeInfo[]> => {
  const typeToChangesRecord = createTypeToChangesRecord(changes, typeToFieldRecord)
  const relevantTypes = Object.keys(typeToChangesRecord)
  const typeToInstancesRecord = await createTypeToInstancesRecord(elementsSource, relevantTypes)
  return relevantTypes.map(typeName => ({
    changesOfType: typeToChangesRecord[typeName],
    instancesOfType: typeToInstancesRecord[typeName],
    uniqueFieldName: typeToFieldRecord[typeName],
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
  fieldName: string,
  fieldValueToInstancesRecord: Record<string, InstanceElement[]>,
): ChangeError | undefined => {
  const fieldValue = getFieldValue(getChangeData(change), fieldName)
  if (fieldValue === undefined) {
    return undefined
  }
  const otherInstance = fieldValueToInstancesRecord[fieldValue].find(
    instance => !instance.elemID.isEqual(getChangeData(change).elemID),
  )
  if (otherInstance === undefined) {
    return undefined
  }
  return getSameUniqueFieldError(change, otherInstance, fieldName)
}

const getErrorsForType = (typeInfo: TypeInfo): ChangeError[] => {
  const { changesOfType, instancesOfType, uniqueFieldName } = typeInfo
  const fieldValueToInstancesRecord = _.groupBy(instancesOfType, instance => getFieldValue(instance, uniqueFieldName))
  return changesOfType
    .map(change => getErrorForChange(change, uniqueFieldName, fieldValueToInstancesRecord))
    .filter(isDefined)
}

export const uniqueFieldsChangeValidatorCreator =
  (typeNameToUniqueFieldRecord: Record<string, string>): ChangeValidator =>
  async (changes, elementsSource) =>
    (await createTypeInfos(changes, elementsSource, typeNameToUniqueFieldRecord)).flatMap(typeInfo =>
      getErrorsForType(typeInfo),
    )
