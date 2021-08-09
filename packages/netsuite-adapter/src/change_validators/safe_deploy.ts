/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { isInstanceChange, InstanceElement, Element,
  ProgressReporter, ChangeError, Change, isInstanceElement, isEqualElements, isRemovalOrModificationChange, getChangeElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { buildNetsuiteQuery, convertToQueryParams, NetsuiteQuery } from '../query'

export type FetchByQueryReturnType = {
  failedToFetchAllAtOnce: boolean
  failedFilePaths: string[]
  failedTypeToInstances: Record<string, string[]>
  elements: Element[]
}

export type FetchByQueryFunc = (
  fetchQuery: NetsuiteQuery,
   progressReporter: ProgressReporter,
   useChangesDetection: boolean)
   => Promise<FetchByQueryReturnType>

export type QueryChangeValidator = (changes: ReadonlyArray<Change>, fetchByQuery?: FetchByQueryFunc)
 => Promise<ReadonlyArray<ChangeError>>

const { awu } = collections.asynciterable

const getMatchingServiceInstances = async (baseInstances: InstanceElement[],
  fetchByQuery: FetchByQueryFunc): Promise<Record<string, InstanceElement>> => {
  const instancesByType = _.groupBy(baseInstances, instance => instance.elemID.typeName)
  const fetchTarget = { types:
    Object.fromEntries(Object.entries(instancesByType)
      .map(([type, instances]) => [type, instances.map(instance => instance.elemID.name)])) }

  const fetchQuery = fetchTarget && buildNetsuiteQuery(convertToQueryParams(fetchTarget))
  if (fetchQuery === undefined) return {}

  const { elements } = await fetchByQuery(fetchQuery, { reportProgress: () => null }, false)
  return _.keyBy(elements.filter(isInstanceElement), element => element.elemID.getFullName())
}

const changeValidator: QueryChangeValidator = async (changes: ReadonlyArray<Change>,
  fetchByQuery?: FetchByQueryFunc) => {
  const errors: ChangeError[] = []

  if (fetchByQuery !== undefined) {
    const modificationOrRemovalInstanceChanges = await awu(changes)
      .filter(isRemovalOrModificationChange)
      .filter(isInstanceChange)
      .toArray()

    const serviceInstances = await getMatchingServiceInstances(
      modificationOrRemovalInstanceChanges.map(change => change.data.before),
      fetchByQuery
    )
    modificationOrRemovalInstanceChanges.forEach(change => {
      const matchingServiceInstance = serviceInstances[change.data.before.elemID.getFullName()]

      if ((change.action === 'modify' && !isEqualElements(change.data.after, matchingServiceInstance)) // TODOH: readability?
       || (change.action === 'remove')) {
        if (!isEqualElements(change.data.before, matchingServiceInstance)) {
          errors.push({
            elemID: getChangeElement(change).elemID,
            severity: 'Warning',
            message: `The element ${getChangeElement(change).elemID.name}, which you are attempting to ${change.action === 'modify' ? 'modify' : 'remove'}, has recently changed in the service.`,
            detailedMessage: 'Continuing the deploy proccess will override the changes made in the service to this element.',
          })
        }
      }
    })
  }

  return errors
}

export default changeValidator
