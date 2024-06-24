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

import { getChangeData, InstanceElement, ReferenceExpression, Element, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import {
  getElementValueOrAnnotations,
  getServiceId,
  isBundleInstance,
  isCustomRecordType,
  isFileCabinetInstance,
  isStandardInstanceOrCustomRecordType,
} from '../types'
import { LocalFilterCreator } from '../filter'
import { BUNDLE_ID_TO_COMPONENTS } from '../autogen/bundle_components/bundle_components'
import { getGroupItemFromRegex } from '../client/utils'

const log = logger(module)
const { isDefined } = values
const { awu } = collections.asynciterable
const BUNDLE = 'bundle'
export const bundleIdRegex = RegExp(`Bundle (?<${BUNDLE}>\\d+)`, 'g')

export const getServiceIdsOfVersion = (bundleId: string, bundleVersion: string | undefined): Set<string> => {
  const bundleVersions = BUNDLE_ID_TO_COMPONENTS[bundleId]
  if (bundleVersion === undefined || !(bundleVersion in bundleVersions)) {
    log.debug(
      `Version ${`${bundleVersion ?? ''} `} of bundle %s is missing or not supported in the record, use a union of all existing versions`,
      bundleId,
    )
    return new Set(Object.values(bundleVersions).flatMap(versionElements => Array.from(versionElements)))
  }
  return bundleVersions[bundleVersion]
}

const addBundleToFileCabinet = (
  fileCabinetInstance: InstanceElement,
  bundleIdToInstance: Record<string, InstanceElement>,
): void => {
  const serviceId = getServiceId(fileCabinetInstance)
  const bundleId = getGroupItemFromRegex(serviceId, bundleIdRegex, BUNDLE)
  if (bundleId.length > 0) {
    const bundleToReference = bundleIdToInstance[bundleId[0]]
    if (!isDefined(bundleToReference)) {
      log.debug('Could not find bundle with id: %s.', bundleId[0])
    } else {
      Object.assign(fileCabinetInstance.value, { bundle: new ReferenceExpression(bundleToReference.elemID) })
    }
  }
}

const isStandardInstanceOrCustomRecord = async (element: Element): Promise<boolean> =>
  isStandardInstanceOrCustomRecordType(element) ||
  (isInstanceElement(element) && isCustomRecordType(await element.getType()))

const addBundleToRecords = (scriptIdToElem: Record<string, Element>, bundleInstance: InstanceElement): void => {
  const bundleElementsServiceIds = getServiceIdsOfVersion(bundleInstance.value.id, bundleInstance.value.version)
  bundleElementsServiceIds.forEach(serviceId => {
    const currentElement = scriptIdToElem[serviceId]
    if (currentElement) {
      getElementValueOrAnnotations(currentElement).bundle = new ReferenceExpression(bundleInstance.elemID)
    }
  })
}

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'bundleIds',
  onFetch: async elements => {
    if (config.fetch.addBundles === false) {
      return
    }
    const [bundleInstances, nonBundleElements] = _.partition(elements, isBundleInstance)
    const [existingBundles, missingBundles] = _.partition(
      bundleInstances,
      bundle => bundle.value.id in BUNDLE_ID_TO_COMPONENTS,
    )
    if (missingBundles) {
      log.debug(
        'The following bundle ids are missing in the bundle record: %o',
        missingBundles.map(bundle => ({
          bundleId: bundle.value.id,
          installedFrom: bundle.value.installedFrom.toUpperCase(),
          publisher: bundle.value.publisher,
        })),
      )
    }
    existingBundles.forEach(bundle => {
      bundle.value.isPrivate = Object.keys(BUNDLE_ID_TO_COMPONENTS[bundle.value.id]).length === 0
    })

    const fileCabinetInstances = nonBundleElements.filter(isFileCabinetInstance)
    const bundleIdToInstance: Record<string, InstanceElement> = Object.fromEntries(
      bundleInstances.map(bundle => [bundle.value.id, bundle]),
    )
    fileCabinetInstances.forEach(fileCabinetInstance => addBundleToFileCabinet(fileCabinetInstance, bundleIdToInstance))

    const scriptIdToElem = _.keyBy(
      await awu(nonBundleElements).filter(isStandardInstanceOrCustomRecord).toArray(),
      getServiceId,
    )
    existingBundles
      .filter(bundle => !bundle.value.isPrivate)
      .forEach(bundle => addBundleToRecords(scriptIdToElem, bundle))
  },

  preDeploy: async changes => {
    await awu(changes)
      .map(getChangeData)
      .filter(isStandardInstanceOrCustomRecord)
      .forEach(element => {
        if (isInstanceElement(element)) {
          element.value = _.omit(element.value, [BUNDLE])
        }
        element.annotations = _.omit(element.annotations, [BUNDLE])
      })
  },
})

export default filterCreator
