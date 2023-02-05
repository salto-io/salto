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
  Element, ElemID,
  isInstanceElement,
  isObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { DetailedDependency, extendGeneratedDependencies, WALK_NEXT_STEP, walkOnElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterWith, LocalFilterCreator } from '../filter'
import { getNamespaceFromString, isInstanceOfType } from './utils'
import { INSTALLED_PACKAGE_METADATA } from '../constants'
import { apiName } from '../transformers/transformer'


const log = logger(module)
const { awu, keyByAsync } = collections.asynciterable
const { isDefined } = values

const addReferencedPackagesAnnotation = (
  element: Element,
  installedPackageElemIDByName: Record<string, ElemID>
): Set<string> => {
  const missingPackageNames = new Set<string>()
  const detailedDependencies: DetailedDependency[] = []
  walkOnElement({
    element,
    func: ({ value }) => {
      if (_.isString(value)) {
        const namespace = getNamespaceFromString(value)
        if (isDefined(namespace)) {
          const installedPackageElemID = installedPackageElemIDByName[namespace]
          if (Object.keys(installedPackageElemIDByName).includes(namespace)) {
            detailedDependencies.push({ reference: new ReferenceExpression(installedPackageElemID) })
          } else {
            missingPackageNames.add(namespace)
          }
        }
      }
      extendGeneratedDependencies(element, detailedDependencies)
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return missingPackageNames
}

const filterCreator: LocalFilterCreator = (): FilterWith<'onFetch'> => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const installedPackageElemIDByName = _.mapValues(
      await keyByAsync(
        await awu(elements)
          .filter(isInstanceOfType(INSTALLED_PACKAGE_METADATA))
          .toArray(),
        apiName,
      ),
      instance => instance.elemID,
    )
    const missingPackageNames = elements
      .filter(e => isInstanceElement(e) || isObjectType(e))
      .flatMap(e => addReferencedPackagesAnnotation(e, installedPackageElemIDByName))
    if (!_.isEmpty(missingPackageNames)) {
      log.warn('Missing packages: %o', missingPackageNames)
    }
  },
})

export default filterCreator
