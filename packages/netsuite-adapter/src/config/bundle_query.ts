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
import { TypesQuery, FileCabinetQuery, CustomRecordsQuery, NetsuiteQuery } from './query'
import { BUNDLE_ID_TO_COMPONENTS } from '../autogen/bundle_components/bundle_components'
import { TYPES_TO_INTERNAL_ID } from '../data_elements/types'


const buildTypesQuery = (bundleId: string, bundleVersion: string): TypesQuery => ({
  isTypeMatch: () => true,
  areAllObjectsMatch: () => false,
  isObjectMatch: ({ instanceId }) => !BUNDLE_ID_TO_COMPONENTS[bundleId][bundleVersion].has(instanceId),
})

const buildFileCabinetQuery = (bundleIds: string[]): FileCabinetQuery => ({
  // TODO should be true if the file path has "bundle <bundleId>" in it
  isFileMatch: filePath => true,
  isParentFolderMatch: () => true,
  areSomeFilesMatch: () => true,
})

const buildeCustomRecordQuery = (bundleIds: string[]): FileCabinetQuery => ({
  // TODO: should be false if the customRecordType is in the bundle
  isCustomRecordTypeMatch = ()
  areAllCustomRecordsMatch = () => false
  // TODO: should be false if the type or instance is in the bundle
  isCustomRecordMatch = () =>
})
