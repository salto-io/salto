import _ from 'lodash'
import wu from 'wu'

import { ParsedBlueprint } from 'salto'
import { isObjectType, isInstanceElement } from 'adapter-api'
import { SaltoWorkspace } from './workspace'
import { EditorRange, PositionContext } from './context'
import { getFieldTypeFromPath } from './completions/suggestions'

interface SaltoDefinition {
  fullname: string
  filename: string
  range: EditorRange
}

// Get an array of all of the "definitions" that are stored in a sepecifi
const getBlueprintDefinitions = (blueprint: ParsedBlueprint): SaltoDefinition[] => {
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

const getDefLocationsByName = (workspace: SaltoWorkspace, fullname: string): SaltoDefinition[] => {
  const allDef = _(workspace.parsedBlueprints).values().map(
    bp => getBlueprintDefinitions(bp)
  ).flatten()
    .groupBy('fullname')
    .value()

  return allDef[fullname] || []
}

export const provideWorkspaceDefinition = (
  workspace: SaltoWorkspace,
  context: PositionContext,
  token: string
): SaltoDefinition[] => {
  if (context.ref && isInstanceElement(context.ref.element)) {
    const refType = (context.ref.path)
      ? getFieldTypeFromPath(context.ref.element.type, context.ref.path.split(' '))
      : context.ref.element.type
    // If we are inside an instance obj, we look for the *field* definitions by
    // field name
    if (isObjectType(refType)) {
      const refField = refType.fields[token]
      const fullName = (refField) ? refField.elemID.getFullName() : token
      return getDefLocationsByName(workspace, fullName)
    }
  }
  // We are not in instance, so we can just look the current token
  return getDefLocationsByName(workspace, token)
}
