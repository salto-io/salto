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
import { isInstanceChange, isModificationChange, ModificationChange, InstanceElement, Element,
  ProgressReporter, ChangeError, Change, isInstanceElement } from '@salto-io/adapter-api'
import { detailedCompare } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { buildNetsuiteQuery, convertToQueryParams, NetsuiteQuery } from '../query'

export type FetchByQueryReturnType = {
  failedToFetchAllAtOnce: boolean
  failedFilePaths: string[]
  failedTypeToInstances: Record<string, string[]>
  elements: Element[]
}

export type FetchByQueryFunc = (fetchQuery: NetsuiteQuery, progressReporter: ProgressReporter)
  => Promise<FetchByQueryReturnType>

export type QueryChangeValidator = (changes: ReadonlyArray<Change>, fetchByQuery?: FetchByQueryFunc)
 => Promise<ReadonlyArray<ChangeError>>

const { awu } = collections.asynciterable

const getMatchingServiceInstances = async (baseInstances: InstanceElement[],
  fetchByQuery: FetchByQueryFunc): Promise<InstanceElement[]> => {
  const instancesByType = _.groupBy(baseInstances, instance => instance.elemID.typeName)
  const fetchTarget = { types:
    Object.fromEntries(Object.entries(instancesByType)
      .map(([type, instances]) => [type, instances.map(instance => instance.elemID.name)])) }

  const fetchQuery = fetchTarget && buildNetsuiteQuery(convertToQueryParams(fetchTarget))
  if (fetchQuery === undefined) return []

  const { elements } = await fetchByQuery(fetchQuery, { reportProgress: () => null })

  const baseInstancesInternalIds = baseInstances.map(instance => instance.annotations.internalId)

  return elements
    .filter(isInstanceElement)
    .filter(element => baseInstancesInternalIds.includes(element.annotations.internalId))
}

const areInstancesEqual = (first: InstanceElement, second: InstanceElement): boolean =>
  (detailedCompare(first, second).length === 0)


const changeValidator: QueryChangeValidator = async (changes: ReadonlyArray<Change>,
  fetchByQuery?: FetchByQueryFunc) => {
  const errors: ChangeError[] = []

  if (fetchByQuery !== undefined) {
    const modificationInstanceChanges = await awu(changes)
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .toArray() as ModificationChange<InstanceElement>[]

    const serviceInstances = await getMatchingServiceInstances(
      modificationInstanceChanges.map(change => change.data.before),
      fetchByQuery
    )

    modificationInstanceChanges.forEach(change => {
      const serviceInstance = serviceInstances.find(instance =>
        change.data.before.annotations.internalId === instance.annotations.internalId)

      if (serviceInstance === undefined) {
        throw new Error(`Could not find the instance ${change.data.before.elemID.name} in the service`)
      }

      if (!areInstancesEqual(change.data.before, serviceInstance)) {
        errors.push({
          elemID: change.data.after.elemID,
          severity: 'Warning',
          message: `The element ${change.data.after.elemID.name}, which you are attempting to change, has recently also changed in the service.`,
          detailedMessage: 'Continuing the deploy proccess will override the changes made in the service to this element.',
        })
      }
    })
  }

  return errors
}

export default changeValidator
