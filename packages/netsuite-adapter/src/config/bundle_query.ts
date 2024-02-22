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

import _ from 'lodash'
import { TypesQuery, FileCabinetQuery, NetsuiteQuery, CustomRecordsQuery } from './query'
import { BUNDLE_ID_TO_COMPONENTS } from '../autogen/bundle_components/bundle_components'
import { SuiteAppBundleType } from '../types/bundle_type'
import { INCLUDE_ALL } from './constants'
import { bundleIdRegex, getServiceIdsOfVersion } from '../filters/bundle_ids'
import { getGroupItemFromRegex } from '../client/utils'
import { BUNDLE } from '../constants'

export type BundlesQueryAndSupportedBundles = {
  query: NetsuiteQuery
  bundlesToInclude: SuiteAppBundleType[]
}

const buildTypesQuery = (components: Set<string>): TypesQuery => ({
  isTypeMatch: () => true,
  areAllObjectsMatch: () => false,
  isObjectMatch: ({ instanceId }) => !components.has(instanceId),
})

const buildFileCabinetQuery = (bundlesInfo: SuiteAppBundleType[]): FileCabinetQuery => {
  const bundleIdSet = new Set(bundlesInfo.map(bundleInfo => bundleInfo.id))
  return {
    isFileMatch: filePath => {
      const bundleId = getGroupItemFromRegex(filePath, bundleIdRegex, BUNDLE)
      return !(bundleId.length > 0 && bundleIdSet.has(bundleId[0]))
    },
    isParentFolderMatch: () => true,
    areSomeFilesMatch: () => true,
  }
}

const buildCustomRecordQuery = (components: Set<string>): CustomRecordsQuery => ({
  isCustomRecordTypeMatch: () => true,
  areAllCustomRecordsMatch: () => false,
  isCustomRecordMatch: ({ instanceId }) => !components.has(instanceId),
})

const getBundlesToExclude = (
  installedBundles: SuiteAppBundleType[],
  bundlesToExclude: string[],
): [SuiteAppBundleType[], SuiteAppBundleType[]] => {
  if (bundlesToExclude.length === 0) {
    return [[], installedBundles]
  }
  if (bundlesToExclude.includes(INCLUDE_ALL)) {
    return [installedBundles, []]
  }
  const bundleMatchers = bundlesToExclude.map(matcher => new RegExp(matcher))
  return _.partition(installedBundles, bundle => bundleMatchers.some(matcher => matcher.test(bundle.id.toString())))
}

export const buildNetsuiteBundlesQuery = (
  installedBundles: SuiteAppBundleType[],
  bundlesToExclude: string[],
): BundlesQueryAndSupportedBundles => {
  const [bundlesToExcludeFromQuery, bundlesToInclude] = getBundlesToExclude(installedBundles, bundlesToExclude)
  const bundlesToExcludeComponentsSet = new Set(
    bundlesToExcludeFromQuery.flatMap(bundle =>
      bundle.id in BUNDLE_ID_TO_COMPONENTS ? Array.from(getServiceIdsOfVersion(bundle.id, bundle.version)) : [],
    ),
  )
  const { isTypeMatch, areAllObjectsMatch, isObjectMatch } = buildTypesQuery(bundlesToExcludeComponentsSet)
  const { isFileMatch, isParentFolderMatch, areSomeFilesMatch } = buildFileCabinetQuery(bundlesToExcludeFromQuery)
  const { isCustomRecordTypeMatch, areAllCustomRecordsMatch, isCustomRecordMatch } =
    buildCustomRecordQuery(bundlesToExcludeComponentsSet)

  return {
    query: {
      isTypeMatch,
      areAllObjectsMatch,
      isObjectMatch,
      isFileMatch,
      isParentFolderMatch,
      areSomeFilesMatch,
      isCustomRecordTypeMatch,
      areAllCustomRecordsMatch,
      isCustomRecordMatch,
    },
    bundlesToInclude,
  }
}
