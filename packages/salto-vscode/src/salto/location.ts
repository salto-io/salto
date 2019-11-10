import _ from 'lodash'
import wu from 'wu'

import { ParsedBlueprint } from 'salto'
import { Element } from 'adapter-api'
import { EditorWorkspace } from './workspace'
import { EditorRange } from './context'

export interface SaltoElemLocation {
  fullname: string
  filename: string
  range: EditorRange
}

const MAX_LOCATION_SEARCH_RESULT = 20

// Get an array of all of the "definitions" that are stored in a sepecifi
const getBlueprintLocations = (blueprint: ParsedBlueprint): SaltoElemLocation[] => {
  // We want to transform the blueprint structure to a flattened def array
  // We start with [elementFullName ... elementFullName]
  const elementNames = wu(blueprint.sourceMap.keys()).toArray()
  return _(elementNames).map(fullname => {
    const ranges = blueprint.sourceMap.get(fullname) || []
    // For each element we create a [def, ... def ] array from the ranges
    // associated with it
    return ranges.map(range => ({
      fullname,
      filename: range.filename,
      range: { start: range.start, end: range.end },
    }))
  // We get [[def,... def] ... [def, ... , def]] so we flatten
  }).flatten().value()
}

const getLocationsByFullname = (
  workspace: EditorWorkspace
): {[key: string]: SaltoElemLocation[]} => (
  _(workspace.parsedBlueprints)
    .values()
    .map(bp => getBlueprintLocations(bp))
    .flatten()
    .groupBy('fullname')
    .value()
)
export const getLocations = (workspace: EditorWorkspace, fullname: string): SaltoElemLocation[] => {
  const allDef = getLocationsByFullname(workspace)
  return allDef[fullname] || []
}

export const getQueryLocations = (
  workspace: EditorWorkspace,
  query: string
): SaltoElemLocation[] => {
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
    const allDef = getLocationsByFullname(workspace)
    return _(allDef)
      .pick(matchingNames)
      .values()
      .flatten()
      .value()
  }

  return []
}
