import _ from 'lodash'

import { Element } from 'adapter-api'
import {
  loadBlueprints, parseBlueprints, mergeElements, validateElements, ParsedBlueprint
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
}

const updateWorkspace = (workspace: SaltoWorkspace): SaltoWorkspace => {
  const allElements = _(workspace.parsedBlueprints).values().map('elements').flatten().value()
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
  const parsedBlueprints = await parseBlueprints(blueprints)
  const fileElements = _(parsedBlueprints).keyBy('filename').mapValues('elements').value()
  const fileErrors = _(parsedBlueprints).keyBy('filename').mapValues('errors').value()
  return updateWorkspace({
    baseDir,
    parsedBlueprints,
    generalErrors: []
  })
}

export const updateFile = async (
  workspace: SaltoWorkspace,
  filename: string,
  content: string
): Promise<SaltoWorkspace> => {
  const bp = { filename, buffer: Buffer.from(content, 'utf8') }
  const parseResult = (await parseBlueprints([bp]))[0]
  workspace.parsedBlueprints[filename] = parseResult
  return updateWorkspace(workspace)
}
