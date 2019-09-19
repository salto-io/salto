import _ from 'lodash'

import { Element } from 'adapter-api'
import {
  loadBlueprints, parseBlueprints, mergeElements, validateElements, ParsedBlueprint,
} from 'salto'

type SaltoError = string
interface ParsedBlueprintMap {
  [key: string]: ParsedBlueprint
}

export interface SaltoWorkspace {
  baseDir: string
  parsedBlueprints: ParsedBlueprintMap
  mergedElements?: Element[]
  generalErrors: SaltoError[]
  lastUpdate?: Promise<SaltoWorkspace>
}

const updateWorkspace = (workspace: SaltoWorkspace): SaltoWorkspace => {
  const allElements = _(workspace.parsedBlueprints).values().map('elements').flatten()
    .value()
  try {
    workspace.mergedElements = mergeElements(allElements)
    workspace.generalErrors = validateElements(workspace.mergedElements).map(e => e.message)
  } catch (e) {
    workspace.mergedElements = []
    workspace.generalErrors = [e.message]
  }
  return workspace
}

export const initWorkspace = async (
  baseDir: string,
  _additionalBPDirs: string[] = [], // Ignored until loadBPs will support multiple dirs
  additionalBPs: string[] = []
): Promise<SaltoWorkspace> => {
  const blueprints = await loadBlueprints(additionalBPs, baseDir)
  const parsedBlueprints = _.keyBy(await parseBlueprints(blueprints), 'filename')
  return updateWorkspace({
    baseDir,
    parsedBlueprints,
    generalErrors: [],
  })
}

export const updateFile = async (
  workspace: SaltoWorkspace,
  filename: string,
  content: string
): Promise<SaltoWorkspace> => {
  const bp = { filename, buffer: Buffer.from(content, 'utf8') }
  let hasErrors = false
  try {
    const parseResult = (await parseBlueprints([bp]))[0]
    const currentBlueprint = workspace.parsedBlueprints[filename]
    hasErrors = parseResult.errors.length > 0
    currentBlueprint.errors = parseResult.errors
    if (!hasErrors) {
      currentBlueprint.elements = parseResult.elements
      currentBlueprint.sourceMap = parseResult.sourceMap
    }
    workspace.parsedBlueprints[filename] = parseResult
  } catch (e) {
    hasErrors = true
  }
  return hasErrors ? workspace : updateWorkspace(workspace)
}
