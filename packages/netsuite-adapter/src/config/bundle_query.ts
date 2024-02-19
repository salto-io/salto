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

import { TypesQuery, FileCabinetQuery, NetsuiteQuery, CustomRecordsQuery } from './query'
import { BUNDLE_ID_TO_COMPONENTS } from '../autogen/bundle_components/bundle_components'
import { CUSTOM_RECORD_TYPE, CUSTOM_SEGMENT } from '../constants'
import { addCustomRecordTypePrefix } from '../types'

export type BundleInfo = {
  id: string
  version: string | undefined
}

const isBundleComponent = (instanceIdOrType: string, bundleId: string, bundleVersion: string | undefined): boolean => {
  if (bundleVersion) {
    return BUNDLE_ID_TO_COMPONENTS[bundleId][bundleVersion].has(instanceIdOrType)
  }
  // version is unsupported, check all supported versions of this bundle
  const versionComponentsUnion = new Set(
    Object.values(BUNDLE_ID_TO_COMPONENTS[bundleId]).flatMap(versionComponents => Array.from(versionComponents))
  )
  return versionComponentsUnion.has(instanceIdOrType)
}

const isContainedInSomeBundle = (instanceIdOrType: string, bundlesInfo: BundleInfo[]): boolean =>
  bundlesInfo.some(({ id, version }) =>
    isBundleComponent(instanceIdOrType, id, version))

const buildTypesQuery = (bundlesInfo: BundleInfo[]): TypesQuery => ({
  isTypeMatch: () => true,
  areAllObjectsMatch: () => false,
  isObjectMatch: ({ instanceId }) => !isContainedInSomeBundle(instanceId, bundlesInfo),
})

const buildFileCabinetQuery = (bundlesInfo: BundleInfo[]): FileCabinetQuery => {
  const regexPatterns = bundlesInfo.map(bundleInfo => new RegExp(`Bundle ${bundleInfo.id}`))

  return {
    isFileMatch: filePath => !regexPatterns.some(regex => regex.test(filePath)),
    isParentFolderMatch: () => true,
    areSomeFilesMatch: () => true,
  }
}

const buildCustomRecordQuery = (bundlesInfo: BundleInfo[]): CustomRecordsQuery => ({
  isCustomRecordTypeMatch: typeName => !isContainedInSomeBundle(typeName, bundlesInfo),
  areAllCustomRecordsMatch: () => false,
  isCustomRecordMatch: ({ type, instanceId }) => !bundlesInfo.some(({ id, version }) =>
    isBundleComponent(type, id, version) || isBundleComponent(instanceId, id, version)),
})

export const buildNetsuiteBundlesQuery = (
  bundlesInfo: BundleInfo[] = [],
): NetsuiteQuery => {
  const {
    isTypeMatch,
    areAllObjectsMatch,
    isObjectMatch,
  } = buildTypesQuery(bundlesInfo)
  const {
    isFileMatch,
    isParentFolderMatch,
    areSomeFilesMatch,
  } = buildFileCabinetQuery(bundlesInfo)

  const {
    isCustomRecordTypeMatch,
    areAllCustomRecordsMatch,
    isCustomRecordMatch,
  } = buildCustomRecordQuery(bundlesInfo)

  return {
    isTypeMatch,
    areAllObjectsMatch,
    isObjectMatch: object => isObjectMatch(object)
    || (object.type === CUSTOM_SEGMENT && isObjectMatch({
      type: CUSTOM_RECORD_TYPE,
      instanceId: addCustomRecordTypePrefix(object.instanceId),
    })),
    isFileMatch,
    isParentFolderMatch,
    areSomeFilesMatch,
    isCustomRecordTypeMatch,
    areAllCustomRecordsMatch,
    isCustomRecordMatch,
  }
}
