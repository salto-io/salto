// This file will be soon merged into salto-cli
import path from 'path'
import * as sourceMapSupport from 'source-map-support'
import { loadBlueprints, dumpBlueprints } from './blueprint'
import { dumpCsv } from './csv'
import { getAllElements, Blueprint } from '../blueprints/blueprint'
import { PlanItem } from '../core/plan'
import {
  createPlanOutput, createActionStartOutput, createActionInProgressOutput,
  createItemDoneOutput, formatSearchResults, subHeader, print, printError,
} from './formatter'
import Prompts from './prompts'
import { getConfigFromUser, shouldApply } from './callbacks'
import * as commands from '../core/commands'
import { createElementsMap, findElement } from '../core/search'

const CURRENT_ACTION_POLL_INTERVAL = 5000

/**
 * Executes the apply action by:
 * 1) Loading the blueprints
 * 2) Calculating the plan
 * 3) Displaying the plan to the user
 * @param  {Array<string>} blueprintsFiles an array of pathes to blueprints files
 * @param  {string} blueprintsDir (Optional) a directory containing blueprints files.
 * @return {Promise<void>} A promise indicating a sucssus, or a reject with
 * an informative error message.
 */
export const plan = async (blueprintsFiles: string[], blueprintsDir?: string): Promise<void> => {
  // catch side effects are commented out for debugging
  // eslint-disable-next-line no-useless-catch
  try {
    const blueprints = await loadBlueprints(
      blueprintsFiles,
      blueprintsDir,
    )
    const actions = await commands.plan(
      blueprints
    )
    const output = [
      createPlanOutput(actions),
      subHeader(Prompts.PLANDISCLAIMER),
    ].join('\n')
    print(output)
  } catch (e) {
    // printError(e)
    throw e
  }
}

/**
 * Executes the apply action by:
 * 1) Loading the blueprints
 * 2) Calculating the plan
 * 3) Displaying the plan to the user
 * 4) Getting the user approval to execute the plan
 * 5) Execute the plan by invoking the apply method.
 * @param  {Array<string>} blueprintsFiles an array of pathes to blueprints files
 * @param  {string} blueprintsDir (Optional) a directory containing blueprints files.
 * @param  {string} force (Optional) indicates that the user should not be prompted
 * for plan approval.
 * @return {Promise<void>} A promise indicating a sucssus, or a reject with
 * an informative error message.
 */
export const applyBase = async (
  blueprintLoader: () => Promise<Blueprint[]>,
  force?: boolean
): Promise<void> => {
  let currentAction: PlanItem | undefined
  let currentActionStartTime: Date | undefined
  let currentActionPollerID: ReturnType<typeof setTimeout> | undefined

  const pollCurentAction = (): void => {
    if (currentActionStartTime && currentAction) {
      print(createActionInProgressOutput(currentAction, currentActionStartTime))
    }
  }

  const endCurrentAction = (): void => {
    if (currentActionPollerID && currentAction && currentActionStartTime) {
      clearInterval(currentActionPollerID)
      print(createItemDoneOutput(currentAction, currentActionStartTime))
    }
    currentAction = undefined
  }

  const updateCurrentAction = (action: PlanItem): void => {
    endCurrentAction()
    currentAction = action
    currentActionStartTime = new Date()
    print(createActionStartOutput(action))
    currentActionPollerID = setInterval(pollCurentAction, CURRENT_ACTION_POLL_INTERVAL)
  }

  try {
    await commands.apply(
      await blueprintLoader(),
      getConfigFromUser,
      shouldApply,
      updateCurrentAction,
      force
    )
    endCurrentAction()
  } catch (e) {
    endCurrentAction()
    const errorSource = sourceMapSupport.getErrorSource(e)
    if (errorSource) {
      printError(errorSource)
    }
    printError(e.stack || e)
  }
}

export const apply = async (
  blueprintsFiles: string[],
  blueprintsDir?: string,
  force?: boolean
): Promise<void> => applyBase(
  () => loadBlueprints(blueprintsFiles, blueprintsDir),
  force,
)

export const describe = async (
  searchWords: string[],
  blueprints?: Blueprint[],
): Promise<void> => {
  const allElements = await getAllElements(blueprints || [])
  const elementsMap = createElementsMap(allElements)
  // First we try with exact match only
  const searchResult = findElement(searchWords, elementsMap, elementsMap)
    // Then we allow near matches
    || findElement(searchWords, elementsMap, elementsMap, false)
  print(formatSearchResults(searchResult))
}

export const setenv = async (): Promise<void> => {
  print('setenv!')
}

export const discoverBase = async (
  outputDir: string,
  blueprints: Blueprint[],
): Promise<void> => {
  const outputBPs = await commands.discover(
    blueprints,
    getConfigFromUser
  )
  outputBPs.forEach(bp => { bp.filename = path.join(outputDir, `${bp.filename}.bp`) })
  await dumpBlueprints(outputBPs)
}

export const discover = async (
  outputDir: string,
  blueprintsFiles: string[],
  blueprintsDir?: string,
): Promise<void> => {
  const blueprints = await loadBlueprints(
    blueprintsFiles,
    blueprintsDir,
  )
  return discoverBase(outputDir, blueprints)
}

export const exportBase = async (
  typeName: string,
  outputPath: string,
  blueprints: Blueprint[],
): Promise<void> => {
  const outputObjects = await commands.exportToCsv(
    typeName,
    blueprints,
    getConfigFromUser
  )

  // Check if output path is provided, otherwise use the template
  // <working dir>/<typeName>_<current timestamp>.csv
  const outPath = outputPath || path.join(path.resolve('./'), `${typeName}_${Date.now()}.csv`)

  await dumpCsv(outputObjects.map(instance => instance.value), outPath)
}
