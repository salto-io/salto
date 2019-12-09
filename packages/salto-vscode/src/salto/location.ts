import _ from 'lodash'

import { Element, ElemID } from 'adapter-api'
import { EditorWorkspace } from './workspace'
import { EditorRange } from './context'

export interface SaltoElemLocation {
  fullname: string
  filename: string
  range: EditorRange
}

const MAX_LOCATION_SEARCH_RESULT = 20

// // Get an array of all of the "definitions" that are stored in a sepecifi
// const getBlueprintLocations = (blueprint: ResolvedParsedBlueprint): SaltoElemLocation[] => {
//   // We want to transform the blueprint structure to a flattened def array
//   // We start with [elementFullName ... elementFullName]
//   const elementNames = wu(blueprint.sourceMap.keys()).toArray()
//   return _(elementNames).map(fullname => {
//     const ranges = blueprint.sourceMap.get(fullname) || []
//     // For each element we create a [def, ... def ] array from the ranges
//     // associated with it
//     return ranges.map(range => ({
//       fullname,
//       filename: range.filename,
//       range: { start: range.start, end: range.end },
//     }))
//   // We get [[def,... def] ... [def, ... , def]] so we flatten
//   }).flatten().value()
// }

// const getLocationsByFullname = async (
//   workspace: EditorWorkspace,
//   names: string[]
// ): Promise<{[key: string]: SaltoElemLocation[]}> => {
//   const bps = await Promise.all(_(names)
//     .map(name => workspace.elementsIndex[name] || [])
//     .flatten()
//     .uniq()
//     .map( name => workspace.getParsedBlueprint(name))
//     .value())
//   return _(bps)
//     .map(bp => getBlueprintLocations(bp))
//     .flatten()
//     .groupBy('fullname')
//     .value()
// }

export const getLocations = async (
  workspace: EditorWorkspace,
  fullname: string
): Promise<SaltoElemLocation[]> => (await workspace.getSourceRanges(ElemID.fromFullName(fullname)))
  .map(range => ({ fullname, filename: range.filename, range }))

export const getQueryLocations = async (
  workspace: EditorWorkspace,
  query: string
): Promise<SaltoElemLocation[]> => {
  const lastIDPartContains = (element: Element): boolean => {
    const fullname = element.elemID.getFullName()
    const firstIndex = fullname.indexOf(query)
    if (firstIndex < 0) return false // If the query is nowhere to be found - this is not a match
    // and we will return here to save the calculation.
    const isPartOfLastNamePart = element.elemID.name.indexOf(query) >= 0
    const isPrefix = fullname.indexOf(query) === 0
    const isSuffix = fullname.lastIndexOf(query) + query.length === fullname.length
    return isPartOfLastNamePart || isPrefix || isSuffix
  }

  const matchingNames = workspace.elements
    .filter(lastIDPartContains)
    .map(e => e.elemID.getFullName())
    .slice(0, MAX_LOCATION_SEARCH_RESULT)

  if (matchingNames.length > 0) {
    const locations = await Promise.all(matchingNames.map(name => getLocations(workspace, name)))
    return _.flatten(locations)
  }
  return []
}
