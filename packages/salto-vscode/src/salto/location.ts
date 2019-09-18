import _ from 'lodash'
import wu from 'wu'

import { SaltoWorkspace } from './workspace'
import { EditorRange } from './context'
import { ParsedBlueprint } from 'salto'

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

export const getLocations = (workspace: SaltoWorkspace, fullname: string): SaltoElemLocation[] => {
  const allDef = _(workspace.parsedBlueprints).values().map(
    bp => getBlueprintLocations(bp)
  ).flatten()
    .groupBy('fullname')
    .value()

  return allDef[fullname] || []
}