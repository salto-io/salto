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
  ChangeError,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { removeIdenticalValues } from '../filters/data_instances_diff'
import { isDataObjectType } from '../types'
import { ACCOUNT_SPECIFIC_VALUE, ID_FIELD, INTERNAL_ID } from '../constants'
import { getSuiteQLNameToInternalIdsMap } from '../data_elements/suiteql_table_elements'
import { getResolvedAccountSpecificValue, getUnknownTypeReferencesMap } from '../filters/data_account_specific_values'
import { NetsuiteChangeValidator } from './types'
import { cloneChange } from './utils'

const getPathsWithUnresolvedAccountSpecificValue = (instance: InstanceElement): ElemID[] => {
  const fieldsWithUnresolvedAccountSpecificValue: ElemID[] = []
  walkOnElement({
    element: instance,
    func: ({ path, value }) => {
      if (
        (value[ID_FIELD] === ACCOUNT_SPECIFIC_VALUE && value[INTERNAL_ID] === undefined) ||
        value[INTERNAL_ID] === ACCOUNT_SPECIFIC_VALUE
      ) {
        fieldsWithUnresolvedAccountSpecificValue.push(path)
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return fieldsWithUnresolvedAccountSpecificValue
}

const getResolvingErrors = ({
  instance,
  unknownTypeReferencesMap,
  suiteQLTablesMap,
}: {
  instance: InstanceElement
  unknownTypeReferencesMap: Record<string, Record<string, string[]>>
  suiteQLTablesMap: Record<string, Record<string, string[]>>
}): ChangeError[] => {
  const changeErrors: ChangeError[] = []
  walkOnElement({
    element: instance,
    func: ({ path, value }) => {
      const { error } = getResolvedAccountSpecificValue(path, value, unknownTypeReferencesMap, suiteQLTablesMap)
      if (error !== undefined) {
        changeErrors.push(error)
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return changeErrors
}

const changeValidator: NetsuiteChangeValidator = async (changes, _deployReferencedElements, elementsSource, config) => {
  const relevantChangedInstances = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => isDataObjectType(getChangeData<InstanceElement>(change).getTypeSync()))
    .map(change => {
      if (isAdditionChange(change)) {
        return change
      }
      const modificationChange = cloneChange(change)
      removeIdenticalValues(modificationChange)
      return modificationChange
    })
    .map(getChangeData)

  if (relevantChangedInstances.length === undefined) {
    return []
  }

  if (config?.fetch.resolveAccountSpecificValues !== false && elementsSource !== undefined) {
    const unknownTypeReferencesMap = await getUnknownTypeReferencesMap(elementsSource)
    const suiteQLTablesMap = await getSuiteQLNameToInternalIdsMap(elementsSource)
    return relevantChangedInstances.flatMap(instance =>
      getResolvingErrors({ instance, unknownTypeReferencesMap, suiteQLTablesMap }),
    )
  }

  return relevantChangedInstances.flatMap(getPathsWithUnresolvedAccountSpecificValue).map((elemID): ChangeError => {
    const { parent, path } = elemID.createBaseID()
    const fieldName = path.join(ElemID.NAMESPACE_SEPARATOR)
    return {
      elemID: parent,
      severity: 'Error',
      message: `${fieldName} has a missing ID and therefore it can't be deployed`,
      detailedMessage: `The missing ID is replaced by Salto with 'ACCOUNT_SPECIFIC_VALUE'.
In order to deploy ${fieldName}, please edit it in Salto and either replace 'ACCOUNT_SPECIFIC_VALUE' with the actual value in the environment you are deploying to or remove ${fieldName}.
If you choose to remove it, after a successful deploy you can assign the correct value in the NetSuite UI.`,
    }
  })
}

export default changeValidator
