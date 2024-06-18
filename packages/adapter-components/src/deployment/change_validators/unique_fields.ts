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
    .filter(change => getChangeData(change).elemID.typeName in typeToFieldRecord)
    .filter(isInstanceChange)

const getFieldValue = (instance: InstanceElement, fieldName: string): string | undefined => {
  const fieldValue = resolvePath(instance, instance.elemID.createNestedID(...fieldName.split('.')))
  if (!_.isString(fieldValue)) {
    log.error('Unique field value is not a string')
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

const getErrorsForType = (
  typeName: string,
  instances: InstanceElement[],
  changes: (ModificationChange<InstanceElement> | AdditionChange<InstanceElement>)[],
  typeToFieldRecord: Record<string, string>,
): ChangeError[] => {
  const changesOfType = changes.filter(change => getChangeData(change).elemID.typeName === typeName)
  const instacesOfType = instances.filter(instance => instance.elemID.typeName === typeName)

  const fieldValueToInstancesRecord = _.groupBy(instacesOfType, instance =>
    getFieldValue(instance, typeToFieldRecord[typeName]),
  )
  return changesOfType
    .map(change => getErrorForChange(change, typeToFieldRecord[typeName], fieldValueToInstancesRecord))
    .filter(isDefined)
}

export const uniqueFieldsChangeValidatorCreator =
  (typeToFieldRecord: Record<string, string>): ChangeValidator =>
  async (changes, elementSource) => {
    const relevantChanges = getRelevantChanges(changes, typeToFieldRecord)
    const relevantTypes = _.uniq(relevantChanges.map(change => getChangeData(change).elemID.typeName))
    const instances = await getInstances(elementSource, relevantTypes)
    return relevantTypes.flatMap(typeName => getErrorsForType(typeName, instances, relevantChanges, typeToFieldRecord))
  }
