import _ from 'lodash'
import wu from 'wu'

import { ParsedBlueprint } from 'salto'
import { EditorWorkspace } from './workspace'
import { EditorRange } from './context'

export interface SaltoElemLocation {
  fullname: string
  filename: string
  range: EditorRange
}

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

const getLocationsByFullname = (workspace: EditorWorkspace): {[key: string] : SaltoElemLocation[]} => (
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

export const getQueryLocations = (workspace: EditorWorkspace, query: string): SaltoElemLocation[] => {
  const queryRegex = new RegExp(query.split('').join('.*'))
  const allDef = getLocationsByFullname(workspace)
  const matchingNames = _.keys(allDef).filter(name => queryRegex.test(name))
  return _(allDef)
    .pick(matchingNames)
    .values()
    .flatten()
    .value()
}
