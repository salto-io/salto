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
import { isInstanceChange, isModificationChange, ModificationChange, InstanceElement, Element,
  ProgressReporter, ChangeError, Change, isInstanceElement } from '@salto-io/adapter-api'
import { detailedCompare } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import { andQuery, buildNetsuiteQuery, convertToQueryParams, NetsuiteQuery } from '../query'

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

const getMatchingServiceInstance = async (baseInstance: InstanceElement,
  fetchByQuery: FetchByQueryFunc): Promise<InstanceElement | undefined> => {
    console.log(`searching for matching object instance for base instance: ${baseInstance.elemID.name}`)
  const config = {
    fetchInclude: { types: [{ name: '.*' }] },
    fetchExclude: { },
    fetchTarget: { types: { [baseInstance.elemID.typeName]: [baseInstance.elemID.name] } },
    skipList: [],
  }

  const fetchQuery = [
    config.fetchTarget && buildNetsuiteQuery(convertToQueryParams(config.fetchTarget)),
  ].filter(values.isDefined).reduce(andQuery)

  const { elements } = await fetchByQuery(fetchQuery, { reportProgress: () => null })

  return elements
    .filter(isInstanceElement)
    .find(element => element.annotations.internalId === baseInstance.annotations.internalId)
}

const areInstancesEqual = (first: InstanceElement, second: InstanceElement): boolean => {
  const detailedChanges = detailedCompare(first, second)
  return detailedChanges.length === 0
}

const changeValidator: QueryChangeValidator = async (changes: ReadonlyArray<Change>,
  fetchByQuery?: FetchByQueryFunc) => {
  console.log('@@@@@@@@@ called safe deploy change validator @@@@@@@@@')
  const errors: ChangeError[] = []

  if (fetchByQuery !== undefined) {
    const modificationInstanceChanges = await awu(changes)
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .toArray() as ModificationChange<InstanceElement>[]

    console.log('found modification changes in instance: %s', modificationInstanceChanges.map(change => change.data.after.elemID.name))

    await awu(modificationInstanceChanges).forEach(async change => {
      const serviceInstance = await getMatchingServiceInstance(change.data.before, fetchByQuery)
      console.log('found service instance: %s', serviceInstance?.elemID.name)

      if (serviceInstance === undefined) {
        throw new Error(`Could not find the instance ${change.data.before.elemID.name} in the service`)
      }

      if (!areInstancesEqual(change.data.before, serviceInstance)) {
        // console.log('$$$$$$$$$$ found that the before instance and service instance do not match! adding a warning $$$$$$$$$$')
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
