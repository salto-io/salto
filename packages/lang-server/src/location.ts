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
import Fuse from 'fuse.js'

import { Element, ElemID, isObjectType } from '@salto-io/adapter-api'
import { EditorWorkspace } from './workspace'
import { EditorRange } from './context'

export interface SaltoElemLocation {
  fullname: string
  filename: string
  range: EditorRange
}

export type SaltoElemFileLocation = Omit<SaltoElemLocation, 'range'>

const MAX_LOCATION_SEARCH_RESULT = 20

const getAllElements = async (workspace: EditorWorkspace):
Promise<ReadonlyArray<Element>> => (await workspace.elements)
  .flatMap(elem => (isObjectType(elem) ? [elem, ...Object.values(elem.fields)] : [elem]))

const createFileLocations = async (
  workspace: EditorWorkspace,
  id: ElemID
): Promise<SaltoElemFileLocation[]> => (await workspace.getElementNaclFiles(id))
  .map(filename => ({ filename,
    fullname: id.getFullName() }))

export const getLocations = async (
  workspace: EditorWorkspace,
  fullname: string
): Promise<SaltoElemLocation[]> =>
  (await workspace.getSourceRanges(ElemID.fromFullName(fullname)))
    .map(range => ({ fullname, filename: range.filename, range }))

export const completeSaltoLocation = async (
  workspace: EditorWorkspace,
  fileLocation: SaltoElemFileLocation,
): Promise<SaltoElemLocation[]> => (await workspace.getSourceMap(fileLocation.filename))
  .get(fileLocation.fullname)?.map(range => ({ ...fileLocation, range })) ?? []

export const getQueryLocations = async (
  workspace: EditorWorkspace,
  query: string,
  sensitive = true,
): Promise<SaltoElemFileLocation[]> => {
  const lastIDPartContains = (element: Element, isSensitive: boolean): boolean => {
    const fullName = element.elemID.getFullName()
    const fullNameToMatch = isSensitive ? fullName : fullName.toLowerCase()
    const queryToCheck = isSensitive ? query : query.toLowerCase()
    const firstIndex = fullNameToMatch.indexOf(queryToCheck)
    if (firstIndex < 0) {
      return false // If the query is nowhere to be found - this is not a match
    }
    // and we will return here to save the calculation.
    const isPartOfLastNamePart = element.elemID.name.indexOf(queryToCheck) >= 0
    const isPrefix = fullNameToMatch.indexOf(queryToCheck) === 0
    const isSuffix = fullNameToMatch.lastIndexOf(queryToCheck)
      + queryToCheck.length === fullNameToMatch.length
    return isPartOfLastNamePart || isPrefix || isSuffix
  }

  const topMatchingIds = (await getAllElements(workspace))
    .filter(e => lastIDPartContains(e, sensitive))
    .map(e => e.elemID)
    .slice(0, MAX_LOCATION_SEARCH_RESULT)

  return _.flatten(
    await Promise.all(topMatchingIds.map(id => createFileLocations(workspace, id)))
  )
}

export const getQueryLocationsFuzzy = async (
  workspace: EditorWorkspace,
  query: string,
): Promise<Fuse.FuseResult<SaltoElemFileLocation>[]> => {
  const elements = await getAllElements(workspace)
  const fuse = new Fuse(
    elements.map(e => e.elemID.getFullName()),
    {
      includeMatches: true,
      ignoreLocation: true,
      sortFn: (a, b) => {
        if (a.score !== b.score) {
          return a.score - b.score
        }
        const aItem = a.item as unknown as string
        const bItem = b.item as unknown as string
        return aItem.length - bItem.length
      },
    }
  )
  const fuseSearchResult = fuse.search(query)
  const topFuzzyResults = fuseSearchResult
    .slice(0, MAX_LOCATION_SEARCH_RESULT)

  if (topFuzzyResults.length > 0) {
    const locationsRes = await Promise.all(topFuzzyResults
      .map(async res => {
        const locations = await createFileLocations(workspace, ElemID.fromFullName(res.item))
        return locations.map(location => ({ ...res, item: location }))
      }))
    return _.flatten(locationsRes)
  }
  return []
}
