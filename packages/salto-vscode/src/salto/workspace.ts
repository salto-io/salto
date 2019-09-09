import _ from 'lodash'

import { Element } from 'adapter-api'
import {
  loadBlueprints, parseBlueprints, mergeElements, validateElements,
} from 'salto'

type SaltoError = string
interface ElementsMap {
  [key: string]: Element[]
}
export interface SaltoWorkspace {
  baseDir: string
  fileElements: ElementsMap
  mergedElements?: Element[]
  fileErrors: { [key: string]: SaltoError[] }
}
const NO_FILE = '*'

const updateWorkspace = (workspace: SaltoWorkspace): SaltoWorkspace => {
  const allElements = _(workspace.fileElements).values().flatten().value()
  try {
    workspace.mergedElements = mergeElements(allElements)
    workspace.fileErrors[NO_FILE] = validateElements(workspace.mergedElements).map(e => e.message)
  } catch (e) {
    workspace.mergedElements = []
    workspace.fileErrors[NO_FILE] = [e.message]
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
    fileElements,
    fileErrors,
  })
}

export const updateFile = async (
  workspace: SaltoWorkspace,
  filename: string,
  content: string
): Promise<SaltoWorkspace> => {
  const bp = { filename, buffer: Buffer.from(content, 'utf8') }
  const parseResult = (await parseBlueprints([bp]))[0]
  workspace.fileElements[filename] = parseResult.elements
  workspace.fileErrors[filename] = parseResult.errors
  return updateWorkspace(workspace)
}
