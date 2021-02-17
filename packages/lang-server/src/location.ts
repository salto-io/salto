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

const MAX_LOCATION_SEARCH_RESULT = 20

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

export const getQueryLocations = async (
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

export const getQueryLocationsFuzzy = async (
  workspace: EditorWorkspace,
  query: string,
): Promise<Fuse.FuseResult<SaltoElemFileLocation>[]> => {
  const elementIds = await awu(getAllElementIDs(await (await workspace.elements).getAll()))
    .map(e => e.getFullName())
    .toArray()
  const fuse = new Fuse(
    elementIds,
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
