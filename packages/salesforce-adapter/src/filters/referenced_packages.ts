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
  Element, ElemID, Field, InstanceElement, isField, isInstanceElement,
  isObjectType, isReferenceExpression,
  ReferenceExpression, SaltoError,
} from '@salto-io/adapter-api'
import { collections, values, types } from '@salto-io/lowerdash'
import {
  createWarningFromMsg,
  extendGeneratedDependencies,
  safeJsonStringify,
  WALK_NEXT_STEP,
  walkOnElement,
} from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterResult, FilterWith } from '../filter'
import { getNamespace, getNamespaceFromString, isInstanceOfType } from './utils'
import { INSTALLED_PACKAGE_METADATA } from '../constants'
import { apiName, isCustomObject } from '../transformers/transformer'


const log = logger(module)
const { awu, keyByAsync } = collections.asynciterable
const { isDefined } = values
const { makeArray } = collections.array

const getNamespacesFromReferences = async (references: ReferenceExpression[]): Promise<string[]> => (
  _.uniq(
    await awu(references)
      .map(reference => reference.getResolvedValue())
      .filter(_.isString)
      .map(getNamespaceFromString)
      .filter(isDefined)
      .toArray()
  )
)

const addReferencedPackagesAnnotation = async (
  element: InstanceElement | Field,
  installedPackageElemIDByName: Record<string, ElemID>
): Promise<Set<string>> => {
  const existingReferences: ReferenceExpression[] = []
  const pathsByReferencedPackageNames: Record<string, ElemID[]> = {}
  const elementNamespace = await getNamespace(isField(element) ? element.parent : element)
  walkOnElement({
    element,
    func: ({ value, path }) => {
      if (isReferenceExpression(value)) {
        existingReferences.push(value)
      } else if (_.isString(value)) {
        const namespace = getNamespaceFromString(value)
        // No reason to add the current namespace, since reference to this Element should create the link by itself
        if (isDefined(namespace) && namespace !== elementNamespace) {
          pathsByReferencedPackageNames[namespace] = makeArray(pathsByReferencedPackageNames[namespace]).concat(path)
        }
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  const pathsByNonReferencedPackageNames = _.omit(
    pathsByReferencedPackageNames,
    await getNamespacesFromReferences(existingReferences)
  )
  log.debug('Element %s had missing references. pathsByNonReferencedPackageNames: %s', element.elemID.getFullName(), safeJsonStringify(pathsByNonReferencedPackageNames))
  const nonReferencedPackages = new Set(Object.keys(pathsByNonReferencedPackageNames))
  nonReferencedPackages.forEach(nonReferencedPackage => {
    const installedPackageElemID = installedPackageElemIDByName[nonReferencedPackage]
    if (installedPackageElemID === undefined) {
      log.warn('No InstalledPackage instance found for package %s', nonReferencedPackage)
    } else {
      extendGeneratedDependencies(element, [{ reference: new ReferenceExpression(installedPackageElemID) }])
    }
  })
  return nonReferencedPackages
}

const createNonReferencedPackagesWarning = (nonReferencedPackages: types.NonEmptyArray<string>): SaltoError => {
  const message = 'Some of your Elements has missing references to Elements from installed packages. '
    + `We suggest you include them in your fetch config: ${safeJsonStringify(nonReferencedPackages)}`
  log.debug(message)
  return createWarningFromMsg(message)
}

const filterCreator = (): FilterWith<'onFetch'> => ({
  name: 'referencedPackagesFilter',
  onFetch: async (elements: Element[]): Promise<FilterResult> => {
    const installedPackageElemIDByName = _.mapValues(
      await keyByAsync(
        await awu(elements)
          .filter(isInstanceOfType(INSTALLED_PACKAGE_METADATA))
          .toArray(),
        apiName,
      ),
      instance => instance.elemID,
    )
    const nonReferencedPackages = _.uniq([
      ...await awu(elements)
        .filter(isInstanceElement)
        .flatMap(e => addReferencedPackagesAnnotation(e, installedPackageElemIDByName))
        .toArray(),
      ...await awu(elements)
        .filter(isObjectType)
        .filter(isCustomObject)
        .flatMap(e => Object.values(e.fields))
        .flatMap(e => addReferencedPackagesAnnotation(e, installedPackageElemIDByName))
        .toArray(),
    ])
    return {
      errors: types.isNonEmptyArray(nonReferencedPackages)
        ? [createNonReferencedPackagesWarning(nonReferencedPackages)]
        : [],
    }
  },
})

export default filterCreator
