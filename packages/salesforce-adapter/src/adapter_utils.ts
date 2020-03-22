/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { METADATA_TYPES_SKIPPED_LIST, FetchError, INSTANCES_REGEX_SKIPPED_LIST } from './types'
import { getNamespaceFromString } from './filters/utils'


export const sortErrorsForDisplay = (errors: FetchError[]): FetchError[] => {
  // Sort order is as follow:
  // - Metadata types
  // - One instnace from each namespace
  // - The rest of the instances
  const metadataTypesSkippedList = errors.filter(e => e.type === METADATA_TYPES_SKIPPED_LIST)
  const instancesRegexSkippedList = errors.filter(e => e.type === INSTANCES_REGEX_SKIPPED_LIST)
  const instanceFromEachNamespace = _(instancesRegexSkippedList)
    .groupBy(e => getNamespaceFromString(e.value))
    .values()
    .map(e => e[0])
    .value()
  const otherInstances = instancesRegexSkippedList
    .filter(e => !instanceFromEachNamespace.includes(e))
  return metadataTypesSkippedList
    .concat(instanceFromEachNamespace)
    .concat(otherInstances)
}
