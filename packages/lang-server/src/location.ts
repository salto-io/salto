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
import Fuse from 'fuse.js'

import { Element, ElemID, isObjectType, isInstanceElement, isField } from '@salto-io/adapter-api'
import { staticFiles } from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { EditorWorkspace } from './workspace'
import { EditorRange } from './context'
import { Token } from './token'

const { awu } = collections.asynciterable

export interface SaltoElemLocation {
  fullname: string
  filename: string
  range: EditorRange
}

export type SaltoElemFileLocation = Omit<SaltoElemLocation, 'range'>
export type LocationResult = SaltoElemFileLocation & { indices: [number, number][] }
export type LocationResults = { totalCount: number; results: LocationResult[] }

export const FUSE_SEARCH_THRESHOLD = 0.3
const MAX_LOCATION_SEARCH_RESULT = 100

export const getAllElements = async (workspace: EditorWorkspace):
Promise<ReadonlyArray<Element>> => awu(await (await workspace.elements).getAll())
  .flatMap(elem => (isObjectType(elem) ? [elem, ...Object.values(elem.fields)] : [elem])).toArray()

const getAllElementIDs = (elements: AsyncIterable<Element>): AsyncIterable<ElemID> => (
  awu(elements)
    .flatMap(
      elem => (isObjectType(elem)
        ? awu([elem, ...Object.values(elem.fields)]).map(e => e.elemID)
        : awu([elem.elemID])
      )
    )
)

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

type StaticFileAttributes = {
  staticFile: unknown
  fullname: string
}
const extractStaticFileAttributes = (
  element: Element, refPath: string[]
): StaticFileAttributes | undefined => {
  if (isInstanceElement(element)) {
    const staticFile = _.get(element.value, refPath)
    const fullname = element.elemID.createNestedID(...refPath).getFullName()
    return { staticFile, fullname }
  }
  if (isObjectType(element)) {
    const staticFile = _.get(element.annotations, refPath)
    const fullname = element.elemID.createNestedID('attr', ...refPath).getFullName()
    return { staticFile, fullname }
  }
  if (isField(element)) {
    const staticFile = _.get(element.annotations, refPath)
    const fullname = element.elemID.createNestedID(...refPath).getFullName()
    return { staticFile, fullname }
  }
  return undefined
}

export const getStaticLocations = (
  element: Element,
  refPath: string[],
  token: Token
): SaltoElemLocation | undefined => {
  const staticFileAttributes = extractStaticFileAttributes(element, refPath)

  if (_.isUndefined(staticFileAttributes)) {
    return undefined
  }
  if (staticFileAttributes.staticFile instanceof staticFiles.AbsoluteStaticFile
    && token.type === 'content'
    && staticFileAttributes.staticFile.filepath === token.value) {
    return {
      fullname: staticFileAttributes.fullname,
      filename: staticFileAttributes.staticFile.absoluteFilePath,
      range: {
        start: {
          line: 1,
          col: 1,
        },
        end: {
          line: 2,
          col: 1,
        },
      },
    }
  }
  return undefined
}

export const completeSaltoLocation = async (
  workspace: EditorWorkspace,
  fileLocation: SaltoElemFileLocation,
): Promise<SaltoElemLocation[]> => (await workspace.getSourceMap(fileLocation.filename))
  .get(fileLocation.fullname)?.map(range => ({ ...fileLocation, range })) ?? []

export const getQueryLocationsExactMatch = async (
  workspace: EditorWorkspace,
  query: string,
  sensitive = true,
): Promise<SaltoElemFileLocation[]> => {
  const lastIDPartContains = (elemID: ElemID, isSensitive: boolean): boolean => {
    const fullName = elemID.getFullName()
    const fullNameToMatch = isSensitive ? fullName : fullName.toLowerCase()
    const queryToCheck = isSensitive ? query : query.toLowerCase()
    const firstIndex = fullNameToMatch.indexOf(queryToCheck)
    if (firstIndex < 0) {
      return false // If the query is nowhere to be found - this is not a match
    }
    // and we will return here to save the calculation.
    const isPartOfLastNamePart = elemID.name.indexOf(queryToCheck) >= 0
    const isPrefix = fullNameToMatch.indexOf(queryToCheck) === 0
    const isSuffix = fullNameToMatch.lastIndexOf(queryToCheck)
      + queryToCheck.length === fullNameToMatch.length
    return isPartOfLastNamePart || isPrefix || isSuffix
  }
  return awu(getAllElementIDs(await (await workspace.elements).getAll()))
    .filter(e => lastIDPartContains(e, sensitive))
    .take(MAX_LOCATION_SEARCH_RESULT)
    .flatMap(id => createFileLocations(workspace, id))
    .toArray()
}

export const createFuzzyFilter = (items: string[]): Fuse<string> =>
  new Fuse(
    items,
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
      threshold: FUSE_SEARCH_THRESHOLD,
      minMatchCharLength: 2,
      useExtendedSearch: true,
    }
  )

export const getQueryLocationsFuzzy = async (
  workspace: EditorWorkspace,
  query: string,
): Promise<Fuse.FuseResult<SaltoElemFileLocation>[]> => {
  const elements = await getAllElements(workspace)
  const fuse = createFuzzyFilter(elements.map(e => e.elemID.getFullName()))
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

export const getQueryLocations = async (
  workspace: EditorWorkspace,
  query: string,
): Promise<LocationResults> => {
  const getMatches = (fullName: string): RegExpMatchArray[] => {
    const regexp = new RegExp(query, 'gi')
    const matches: RegExpMatchArray[] = []
    let match = regexp.exec(fullName)
    while (match !== null) {
      matches.push(match)
      match = regexp.exec(fullName)
    }
    return matches
  }

  const elemIDToMatches: Record<string, RegExpMatchArray[]> = {}
  const elementIDs = (await getAllElements(workspace)).map(e => e.elemID)
  elementIDs.forEach(e => {
    const id = e.getFullName()
    if (e.isTopLevel()) {
      elemIDToMatches[id] = elemIDToMatches[id] ?? getMatches(id)
    } else {
      const topLevelId = e.createTopLevelParentID().parent.getFullName()
      if (elemIDToMatches[topLevelId] === undefined) {
        elemIDToMatches[topLevelId] = getMatches(topLevelId)
      }
      const matches = getMatches(id)
      elemIDToMatches[id] = (matches.length === elemIDToMatches[topLevelId].length) ? [] : matches
    }
  })
  const matches = _.pickBy(elemIDToMatches, c => c.length > 0)
  const results = Object.keys(matches).slice(0, MAX_LOCATION_SEARCH_RESULT)
  if (results.length > 0) {
    const locationsRes = await Promise.all(results
      .map(async res => {
        const locations = await createFileLocations(workspace, ElemID.fromFullName(res))
        return locations
          .map(location => ({
            ...location,
            indices: matches[res].map(m =>
              [(m.index as number), (m.index as number) + query.length] as [number, number]),
          }))
      }))
    return { totalCount: Object.keys(matches).length, results: _.flatten(locationsRes) }
  }
  return { totalCount: 0, results: [] }
}
