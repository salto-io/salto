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
  Element,
  ElemID,
  isInstanceElement,
  isObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { collections, multiIndex, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import {
  extendGeneratedDependencies,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { LocalFilterCreator } from '../filter'
import {
  INSTALLED_PACKAGE_METADATA,
  INSTALLED_PACKAGES_PATH,
} from '../constants'
import {
  buildElementsSourceForFetch,
  getNamespace,
  getNamespaceSync,
  isInstanceOfType,
  isStandardObject,
  metadataTypeSync,
} from './utils'
import { apiName } from '../transformers/transformer'

const { isDefined } = values
const { awu } = collections.asynciterable
const { makeArray } = collections.array
const log = logger(module)

const addInstalledPackageReference = async (
  element: Element,
  installedPackageNamespaceToRef: multiIndex.Index<[string], ElemID>,
): Promise<boolean> => {
  const namespace = await getNamespace(element)
  if (namespace === undefined) {
    return false
  }
  const installedPackageElemID = installedPackageNamespaceToRef.get(namespace)
  if (installedPackageElemID === undefined) {
    return false
  }
  const reference = new ReferenceExpression(installedPackageElemID)
  extendGeneratedDependencies(element, [{ reference }])
  return true
}

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'installedPackageGeneratedDependencies',
  onFetch: async (elements: Element[]) => {
    const knownInstancesNamespaces = _.uniq(
      elements.map(getNamespaceSync).filter(isDefined),
    )
    log.debug(
      `About to add InstalledPackage generated dependencies to Elements from the following namespaces: ${safeJsonStringify(knownInstancesNamespaces)}`,
    )
    const referenceElements = buildElementsSourceForFetch(elements, config)
    const installedPackageNamespaceToRef = await multiIndex.keyByAsync({
      iter: await referenceElements.getAll(),
      filter: isInstanceOfType(INSTALLED_PACKAGE_METADATA),
      key: async (inst) => [await apiName(inst)],
      map: (inst) => inst.elemID,
    })
    if (_.isEmpty(Object.keys(installedPackageNamespaceToRef))) {
      return
    }
    const affectedTopLevelElements = await awu(elements)
      .filter((element) =>
        addInstalledPackageReference(element, installedPackageNamespaceToRef),
      )
      .toArray()
    // CustomFields of Standard Objects
    const affectedFields = await awu(elements)
      .filter(isObjectType)
      .filter(isStandardObject)
      .flatMap((standardObject) => Object.values(standardObject.fields))
      .filter((standardObject) =>
        addInstalledPackageReference(
          standardObject,
          installedPackageNamespaceToRef,
        ),
      )
      .toArray()
    log.debug(
      `Added InstalledPackage instance generated dependencies to ${affectedTopLevelElements.length + affectedFields.length} Elements`,
    )
    const instancesInWrongPath = affectedTopLevelElements
      .filter(isInstanceElement)
      .filter(
        (instance) =>
          !makeArray([...(instance.path ?? [])]).includes(
            INSTALLED_PACKAGES_PATH,
          ),
      )
    if (instancesInWrongPath.length > 0) {
      const instancesInWrongPathByType = _.groupBy(
        instancesInWrongPath,
        metadataTypeSync,
      )
      const summary: Record<string, { count: number; example: string }> = {}
      Object.entries(instancesInWrongPathByType).forEach(
        ([type, instances]) => {
          summary[type] = {
            count: instances.length,
            example: instances[0].elemID.getFullName(),
          }
        },
      )
      log.debug(
        `some Metadata Instances are not under the InstalledPackages directory. summary: ${safeJsonStringify(summary)}`,
      )
    }
  },
})

export default filterCreator
