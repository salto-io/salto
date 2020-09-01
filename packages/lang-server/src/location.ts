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

const MAX_LOCATION_SEARCH_RESULT = 20

const getAllElements = async (workspace: EditorWorkspace):
Promise<ReadonlyArray<Element>> => {
  const topLevelElements = await workspace.elements
  const fields = topLevelElements
    .filter(isObjectType)
    .map(elem => Object.values(elem.fields))
    .flat()
  return [...topLevelElements, ...fields]
}

export const getLocations = async (
  workspace: EditorWorkspace,
  fullname: string
): Promise<SaltoElemLocation[]> =>
  (await workspace.getSourceRanges(ElemID.fromFullName(fullname)))
    .map(range => ({ fullname, filename: range.filename, range }))

export const getQueryLocations = async (
  workspace: EditorWorkspace,
  query: string,
  sensitive = true,
): Promise<SaltoElemLocation[]> => {
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

  const topMatchingNames = (await getAllElements(workspace))
    .filter(e => lastIDPartContains(e, sensitive))
    .map(e => e.elemID.getFullName())
    .slice(0, MAX_LOCATION_SEARCH_RESULT)

  if (topMatchingNames.length > 0) {
    const locations = await Promise.all(topMatchingNames
      .map(name => getLocations(workspace, name)))
    return _.flatten(locations)
  }
  return []
}

export const getQueryLocationsFuzzy = async (
  workspace: EditorWorkspace,
  query: string,
): Promise<Fuse.FuseResult<SaltoElemLocation>[]> => {
  const elements = await getAllElements(workspace)
  const fuse = new Fuse(elements.map(e => e.elemID.getFullName()), { includeMatches: true })
  const fuseSearchResult = fuse.search(query)
  const topFuzzyResults = fuseSearchResult
    .slice(0, MAX_LOCATION_SEARCH_RESULT)

  if (topFuzzyResults.length > 0) {
    const locationsRes = await Promise.all(topFuzzyResults
      .map(async res => {
        const locations = await getLocations(workspace, res.item)
        return locations.map(location => ({ ...res, item: location }))
      }))
    return _.flatten(locationsRes)
  }
  return []
}
