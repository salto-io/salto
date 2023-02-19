/*
*                      Copyright 2023 Salto Labs Ltd.
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
  ChangeValidator,
  CORE_ANNOTATIONS,
  Element,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { collections, types, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { isSubscriberPackageInstance, isToolingInstance, ToolingInstance } from '../tooling/types'

const { awu } = collections.asynciterable
const { makeArray } = collections.array
const { isNonEmptyArray } = types
const { isDefined } = values

const getDependentPackages = (element: Element): ToolingInstance['SubscriberPackage'][] => (
  makeArray(element.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES])
    .map(dependency => dependency.reference)
    .filter(isInstanceElement)
    .filter(isToolingInstance)
    .filter(isSubscriberPackageInstance)
)

const createMissingNamespacesChangeError = (
  { elemID }: Element,
  missingPackageNamespaces: types.NonEmptyArray<string>
): ChangeError => ({
  elemID,
  severity: 'Error',
  message: 'Element is dependent on non installed package',
  detailedMessage: `Missing dependent package namespaces: ${missingPackageNamespaces.join(', ')}`,
})

const changeValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    return []
  }
  const relevantChanges = changes
    .filter(isAdditionOrModificationChange)
    .filter(change => getDependentPackages(getChangeData(change)).length > 0)
  const dependentPackages = relevantChanges
    .flatMap(change => getDependentPackages(getChangeData(change)))
  const missingPackages = await awu(dependentPackages)
    .filter(async dependentPackage => !(await elementsSource.get(dependentPackage.elemID)))
    .toArray()

  if (_.isEmpty(missingPackages)) {
    return []
  }

  return relevantChanges
    .map(getChangeData)
    .map(element => {
      const missingPackageNamespaces = getDependentPackages(element)
        .filter(dependentPackage => missingPackages.includes(dependentPackage))
        .map(dependentPackage => dependentPackage.value.NamespacePrefix)
      return isNonEmptyArray(missingPackageNamespaces)
        ? createMissingNamespacesChangeError(element, missingPackageNamespaces)
        : undefined
    })
    .filter(isDefined)
}

export default changeValidator
