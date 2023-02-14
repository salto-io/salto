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
  Element,
  Field,
  InstanceElement,
  isInstanceElement,
  isObjectType,
  isReferenceExpression,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { extendGeneratedDependencies, WALK_NEXT_STEP, walkOnElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterWith } from '../filter'
import { getNamespace, getNamespaceFromString, isInstanceOfType, isStandardObject } from './utils'
import { INSTALLED_PACKAGE_METADATA } from '../constants'
import { apiName, isCustomObject } from '../transformers/transformer'

const { awu, keyByAsync } = collections.asynciterable
const { isDefined } = values

const getNonReferencedPackageNames = async (
  element: Element,
): Promise<Set<string>> => {
  const references: ReferenceExpression[] = []
  const packageNamesFromValues = new Set<string>()
  walkOnElement({
    element,
    func: ({ value }) => {
      if (isReferenceExpression(value)) {
        references.push(value)
      } else if (_.isString(value)) {
        const namespace = getNamespaceFromString(value)
        if (isDefined(namespace)) {
          packageNamesFromValues.add(namespace)
        }
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  const packageNamesFromRefs = new Set(references
    .map(reference => reference.elemID.name)
    .map(getNamespaceFromString)
    .filter(isDefined))
  return new Set([...packageNamesFromValues].filter(packageName => !packageNamesFromRefs.has(packageName)))
}

const filterCreator = (): FilterWith<'onFetch'> => ({
  name: 'referencedPackagesFilter',
  onFetch: async (elements: Element[]): Promise<void> => {
    const packageElemIDByName = _.mapValues(
      await keyByAsync(
        await awu(elements)
          .filter(isInstanceOfType(INSTALLED_PACKAGE_METADATA))
          .toArray(),
        apiName,
      ),
      instance => instance.elemID,
    )

    const addDependencies = async (element: ObjectType | Field | InstanceElement): Promise<void> => {
      const packagesToReference = await getNonReferencedPackageNames(element)
      const elementNamespace = await getNamespace(element)
      if (isDefined(elementNamespace)) {
        packagesToReference.add(elementNamespace)
      }
      const dependencies = Object.entries(packageElemIDByName)
        .filter(([packageName]) => packagesToReference.has(packageName))
        .map(([_name, elemID]) => ({ reference: new ReferenceExpression(elemID) }))

      extendGeneratedDependencies(element, dependencies)
    }

    const customObjects = await awu(elements)
      .filter(isObjectType)
      .filter(isCustomObject)
      .toArray()
    // CustomObjects from InstalledPackages
    await awu(customObjects).forEach(addDependencies)
    // CustomFields on StandardObjects from InstalledPackages
    await awu(customObjects)
      .filter(isStandardObject)
      .flatMap(standardObject => Object.values(standardObject.fields))
      .forEach(addDependencies)
    // Instances from InstalledPackages
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(addDependencies)
  },
})

export default filterCreator
