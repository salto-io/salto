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
  Field,
  isInstanceElement,
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
  getNamespaceSync,
  isInstanceOfType,
  isStandardObjectSync,
  metadataTypeSync,
} from './utils'
import { apiName } from '../transformers/transformer'

const { isDefined } = values
const { makeArray } = collections.array
const log = logger(module)

const installedPackageReference = (
  element: Element,
  installedPackageNamespaceToRef: multiIndex.Index<[string], ElemID>,
): ReferenceExpression | undefined => {
  const namespace = getNamespaceSync(element)
  if (namespace === undefined) {
    return undefined
  }
  const installedPackageElemID = installedPackageNamespaceToRef.get(namespace)
  if (installedPackageElemID === undefined) {
    return undefined
  }
  return new ReferenceExpression(installedPackageElemID)
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
    const topLevelElementsReferences = elements
      .map((element): [Element, ReferenceExpression | undefined] => [
        element,
        installedPackageReference(element, installedPackageNamespaceToRef),
      ])
      .filter(
        (
          elementReference,
        ): elementReference is [Element, ReferenceExpression] =>
          elementReference[1] !== undefined,
      )
    // CustomFields of Standard Objects
    const fieldsReferences = elements
      .filter(isStandardObjectSync)
      .flatMap((standardObject) => Object.values(standardObject.fields))
      .map((field): [Field, ReferenceExpression | undefined] => [
        field,
        installedPackageReference(field, installedPackageNamespaceToRef),
      ])
      .filter(
        (fieldReference): fieldReference is [Field, ReferenceExpression] =>
          fieldReference[1] !== undefined,
      )

    if (
      !config.fetchProfile.isCustomReferencesHandlerEnabled('managedElements')
    ) {
      topLevelElementsReferences
        .concat(fieldsReferences)
        .map(([element, reference]) =>
          extendGeneratedDependencies(element, [{ reference }]),
        )
      log.debug(
        `Added InstalledPackage instance generated dependencies to ${topLevelElementsReferences.length + fieldsReferences.length} Elements`,
      )
    } else {
      log.debug(
        'Managed elements custom references handler enabled, not adding explicit references.',
      )
    }

    const instancesInWrongPath = topLevelElementsReferences
      .map(([element, _reference]) => element)
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
        `Some Metadata Instances are not under the InstalledPackages directory. summary: ${safeJsonStringify(summary)}`,
      )
    }
  },
})

export default filterCreator
