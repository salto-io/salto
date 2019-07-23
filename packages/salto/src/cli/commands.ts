// This file will be soon merged into salto-cli
import { PlanAction } from 'adapter-api'
import { loadBlueprints, dumpBlueprint } from './blueprint'
import { getAllElements } from '../core/core'
import {
  createPlanOutput, createActionStartOutput, createActionInProgressOutput,
  createActionDoneOutput, formatSearchResults, subHeader, print, printError,
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
    printError(e)
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
export const apply = async (
  blueprintsFiles: string[],
  blueprintsDir?: string,
  force?: boolean
): Promise<void> => {
  let currentAction: PlanAction | undefined
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
      print(createActionDoneOutput(currentAction, currentActionStartTime))
    }
    currentAction = undefined
  }

  const updateCurrentAction = (action: PlanAction): void => {
    endCurrentAction()
    currentAction = action
    currentActionStartTime = new Date()
    print(createActionStartOutput(action))
    currentActionPollerID = setInterval(pollCurentAction, CURRENT_ACTION_POLL_INTERVAL)
  }

  try {
    const blueprints = await loadBlueprints(
      blueprintsFiles,
      blueprintsDir,
    )
    await commands.apply(
      blueprints,
      getConfigFromUser,
      shouldApply,
      updateCurrentAction,
      force
    )
    endCurrentAction()
  } catch (e) {
    endCurrentAction()
    printError(e)
  }
}

export const describe = async (
  searchWords: string[]
): Promise<void> => {
  const allElements = await getAllElements([])
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

export const discover = async (
  outputFilename: string,
  blueprintsFiles: string[],
  blueprintsDir?: string,
): Promise<void> => {
  const blueprints = await loadBlueprints(
    blueprintsFiles,
    blueprintsDir,
  )
  const outputBP = await commands.discover(
    blueprints,
    getConfigFromUser
  )
  outputBP.filename = outputFilename
  await dumpBlueprint(outputBP)
}
