// apply | plan | discover | describe | setenv
import chalk from 'chalk'
import * as inquirer from 'inquirer'
import * as fs from 'async-file'
import * as path from 'path'
import Fuse from 'fuse.js'
import _ from 'lodash'
import wu from 'wu'

import {
  Plan, PlanAction, isPrimitiveType, PrimitiveTypes, ElemID,
  isListType, isObjectType, Element, isType, InstanceElement, Type, ObjectType,
} from 'adapter-api'
import Prompts from './prompts'
import Blueprint from '../core/blueprint'
import * as core from '../core/core'

type OptionalString = string | undefined
type NotFound = null
type ElementMap = Record<string, Element>
interface FoundSearchResult {
  key: string
  element: Element
  isGuess: boolean
}
type SearchResult = FoundSearchResult | NotFound

const CURRENT_ACTION_POLL_INTERVAL = 5000

const print = (txt: string): void => {
  // eslint-disable-next-line no-console
  console.log(txt)
}

const printError = (txt: string): void => {
  // eslint-disable-next-line no-console
  console.error(chalk.red(txt))
}

const header = (txt: string): string => chalk.bold(txt)

const subHeader = (txt: string): string => chalk.grey(txt)

const body = (txt: string): string => chalk.reset(txt)

const warn = (txt: string): string => chalk.red(txt)

const emptyLine = (): string => ''

/**
 * Prints a line seperator to the screen
 */
const seperator = (): string => `\n${'-'.repeat(78)}\n`

/**
 * Prompts the user for boolean input and returns the result.
 * @param  {string} prompt the text of the question to display to the user
 * @return {Promise<boolean>} A promise with user anwser to the question
 */
const getUserBooleanInput = async (prompt: string): Promise<boolean> => {
  const question = {
    name: 'userInput',
    message: prompt,
    type: 'confirm',
  }
  const answers = await inquirer.prompt(question)
  return answers.userInput
}

/** *********************************************** */
/**          Blueprints loading methods          * */
/** *********************************************** */

/**
 * Extract the pathes of all of the blueprints file in a specific directory.
 * @param {string} blueprintsDir The path for the directory in which the bp files are present.
 * @returns {Promise<Array<Blueprint>>} A promise whos input is an array of the bp files pathes.
 */
const getBluePrintsFromDir = async (
  blueprintsDir: string,
): Promise<string[]> => {
  const dirFiles = await fs.readdir(blueprintsDir)
  return dirFiles
    .filter(f => path.extname(f).toLowerCase() === '.bp')
    .map(f => path.join(blueprintsDir, f))
}

/**
 * Reads a blueprints file.
 * @param {string} blueprintsFile a path to a valid blueprints file.
 * @returns The content of the file.
 */
const loadBlueprint = async (blueprintFile: string): Promise<Blueprint> => ({
  buffer: await fs.readFile(blueprintFile, 'utf8'),
  filename: blueprintFile,
})

/**
 * Reads all of the blueprints specified by the use by full name, or by providing the directory
 * inwhich they resides.
 * @param  {Array<string>} blueprintsFile An array of pathes to blueprint files to load.
 * @param  {string} A path to the blueprints directory //TODO - Should this also be an array?
 * @return {Promise<Array<string>>} A promise with an array of the bp files content as values
 */
const loadBlueprints = async (
  blueprintsFiles: string[],
  blueprintsDir?: string,
): Promise<Blueprint[]> => {
  try {
    let allBlueprintsFiles = blueprintsFiles
    if (blueprintsDir) {
      const dirFiles = await getBluePrintsFromDir(blueprintsDir)
      allBlueprintsFiles = allBlueprintsFiles.concat(dirFiles)
    }
    const blueprints = allBlueprintsFiles.map(loadBlueprint)
    return await Promise.all(blueprints)
  } catch (e) {
    throw Error(`Failed to load blueprints files: ${e.message}`)
  }
}

/**
 * Write blueprint to file
 * @param blueprint The blueprint to dump
 */
const dumpBlueprint = (
  blueprint: Blueprint
): Promise<void> => fs.writeFile(blueprint.filename, blueprint.buffer)

/** ****************************************** */
/**         Plan private functions          * */
/** ****************************************** */

/**
 * Normalize the values returned by the action plan object in order to print them nicely to
 * the screen.
 * This is needed for example in order to print strings with enclosing quatation marks, etc.
 * @param  {any} value the plan value to normalize
 * @return {string} a normnalized string of the value, ready to be printed
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const normalizeValuePrint = (value: any): string => {
  if (typeof value === 'string') {
    return `"${value}"`
  }
  if (typeof value === 'undefined') {
    return 'undefined'
  }
  if (Array.isArray(value)) {
    return `[${value.map(normalizeValuePrint)}]`
  }
  return JSON.stringify(value)
}

const createCountPlanActionTypesOutput = (plan: Plan): string => {
  const counter = _.countBy(plan, 'action')
  return (
    `${chalk.bold('Plan: ')}${counter.add} to add`
    + `  ${counter.modify} to change`
    + `  ${counter.remove} to remove.`
  )
}

const createdActionStepValue = (step: PlanAction): string => {
  if (step.action === 'modify') {
    return (
      `${normalizeValuePrint(step.data.before)}`
      + ` => ${normalizeValuePrint(step.data.after)}`
    )
  }
  if (step.action === 'add') {
    return `${normalizeValuePrint(step.data.after)}`
  }
  return `${normalizeValuePrint(step.data.before)}`
}

const createPlanActionName = (step: PlanAction): string => (step.data.before
  ? step.data.before.elemID.getFullName()
  : (step.data.after as Element).elemID.getFullName())

const createPlanStepTitle = (
  step: PlanAction,
  printModifiers?: boolean,
): string => {
  const modifier = printModifiers ? Prompts.MODIFIERS[step.action] : ' '
  const stepDesc = `${modifier} ${createPlanActionName(step)} ${step.action}`
  const stepValue = createdActionStepValue(step)
  return step.subChanges ? stepDesc : [stepDesc, stepValue].join(':')
}

const createPlanStepOutput = (
  step: PlanAction,
  printModifiers: boolean,
  identLevel: number = 1,
): string => {
  const stepTitle = createPlanStepTitle(step, printModifiers)
  const stepChildren = step.subChanges
    ? wu(step.subChanges).map((subChange: PlanAction): string => {
      const printChildModifiers = subChange.action === 'modify'
      return createPlanStepOutput(subChange, printChildModifiers, identLevel + 1)
    }).toArray()
    : []

  const allLines = [stepTitle].concat(stepChildren)

  const prefix = '  '.repeat(identLevel)
  return allLines
    .map(line => prefix + line)
    .join('\n')
}

const createPlanStepsOutput = (
  plan: Plan
): string => wu(plan).map(step => createPlanStepOutput(step, true))
  .toArray().join('\n\n')

const createPlanOutput = (plan: Plan): string => {
  const actionCount = createCountPlanActionTypesOutput(plan)
  const planSteps = createPlanStepsOutput(plan)
  return [
    header(Prompts.STARTPLAN),
    subHeader(Prompts.EXPLAINPLAN),
    seperator(),
    subHeader(Prompts.EXPLAINPLANRESULT),
    emptyLine(),
    planSteps,
    emptyLine(),
    actionCount,
  ].join('\n')
}

/** ****************************************** */
/**       Describe private functions        * */
/** ****************************************** */

const createElementsMap = (
  elements: Element[]
): ElementMap => elements.reduce(
  (accumulator: ElementMap, element: Element) => {
    accumulator[element.elemID.getFullName()] = element
    return accumulator
  }, {}
)

const notifyDescribeNoMatch = (): string => warn(Prompts.DESCRIBE_NOT_FOUND)

const notifyDescribeNearMatch = (result: FoundSearchResult): string => [
  header(Prompts.DESCRIBE_NEAR_MATCH),
  emptyLine(),
  subHeader(`\t${Prompts.DID_YOU_MEAN} ${chalk.bold(result.key)}?`),
  emptyLine(),
].join('\n')

const formatElementDescription = (element: Element): string => {
  if (isType(element) && element.annotationsValues.description) {
    return [emptyLine(), element.annotationsValues.description].join('\n')
  }
  return emptyLine()
}

const formatSearchResults = (
  result: SearchResult
): string => {
  if (!(result && result.element)) {
    return notifyDescribeNoMatch()
  }
  if (result.isGuess) {
    return notifyDescribeNearMatch(result)
  }
  const { element } = result
  const elementName = element.elemID.getFullName()
  const title = header(`=== ${elementName} ===`)
  const description = subHeader(formatElementDescription(element))
  // TODO - Change to dump HCL
  const elementHCL = body(JSON.stringify(element, null, 2))
  return [title, description, elementHCL].join('\n')
}

const getMatchingElementName = (
  searchWord: string,
  elementsNames: string[],
  exactMatchOnly: boolean = true,
): OptionalString => {
  const options = {
    shouldSort: true,
    threshold: exactMatchOnly ? 0 : 0.7,
    minMatchCharLength: exactMatchOnly
      ? searchWord.length
      : searchWord.length - 2,
  }
  const fuse = new Fuse(elementsNames, options)
  const matches = fuse.search(searchWord)
  return matches.length > 0 ? elementsNames[+matches[0]] : undefined
}

const skipListElement = (element: Element): Element => {
  if (isListType(element) && element.elementType) {
    return skipListElement(element.elementType)
  }
  return element
}

const findElement = (
  keyParts: string[],
  topLevelElements: ElementMap,
  searchElements: ElementMap,
  exactMatchOnly: boolean = true,
): SearchResult => {
  const searchWord = keyParts[0]
  const keyPartsRem = keyParts.slice(1)
  const bestKey = getMatchingElementName(
    searchWord,
    Object.keys(searchElements),
    exactMatchOnly,
  )

  if (!bestKey) {
    return null
  }

  const bestElemId = skipListElement(searchElements[bestKey]).elemID
  const bestElement = topLevelElements[bestElemId.getFullName()]
  const isGuess = bestKey !== searchWord
  if (!_.isEmpty(keyPartsRem)) {
    const res = isObjectType(bestElement)
      ? findElement(
        keyPartsRem,
        topLevelElements,
        Object.assign({}, ...Object.values(bestElement.fields).map(f => ({ [f.name]: f.type }))),
        exactMatchOnly
      )
      : null

    return res
      ? {
        key: `${bestKey}.${res.key}`,
        element: res.element,
        isGuess: isGuess || res.isGuess,
      }
      : null
  }
  return { key: bestKey, element: bestElement, isGuess }
}


export const getFieldInputType = (field: Type): string => {
  if (!isPrimitiveType(field)) {
    throw new Error('Only primitive configuration values are supported')
  }
  if (field.primitive === PrimitiveTypes.STRING) {
    return 'input'
  }
  if (field.primitive === PrimitiveTypes.NUMBER) {
    return 'number'
  }
  return 'confirm'
}

const getConfigFromUser = async (configType: ObjectType): Promise<InstanceElement> => {
  const questions = Object.keys(configType.fields).map(fieldName =>
    ({
      type: getFieldInputType(configType.fields[fieldName].type),
      name: fieldName,
      message: `Enter ${fieldName} value:`,
    }))
  const values = await inquirer.prompt(questions)
  const elemID = new ElemID(configType.elemID.adapter, ElemID.CONFIG_INSTANCE_NAME)
  return new InstanceElement(elemID, configType, values)
}

/** ******************************************* */
/**            Public functions              * */
/** ******************************************* */

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
    const actions = await core.plan(
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

const getElapsedTime = (start: Date): number => Math.ceil(
  (new Date().getTime() - start.getTime()) / 1000,
)

const createActionDoneOutput = (
  currentAction: PlanAction,
  currentActionStartTime: Date
): string => {
  const elapsed = getElapsedTime(currentActionStartTime)
  return `${createPlanActionName(currentAction)}: `
        + `${Prompts.ENDACTION[currentAction.action]} `
        + `completed after ${elapsed}s`
}

const createActionStartOutput = (action: PlanAction): string => {
  const output = [
    emptyLine(),
    body(`${createPlanActionName(action)}: ${Prompts.STARTACTION[action.action]}...`),
  ]
  return output.join('\n')
}

const createActionInProgressOutput = (action: PlanAction, start: Date): string => {
  const elapsed = getElapsedTime(start)
  const elapsedRound = Math.ceil((elapsed - elapsed) % 5)
  return body(`${createPlanActionName(action)}: Still ${
    Prompts.STARTACTION[action.action]
  }... (${elapsedRound}s elapsed)`)
}

const shouldApply = (actions: Plan): Promise<boolean> => {
  const planOutput = [
    header(Prompts.STARTAPPLY),
    subHeader(Prompts.EXPLAINAPPLY),
    createPlanOutput(actions),
  ].join('\n')
  print(planOutput)
  const shouldExecute = getUserBooleanInput(Prompts.SHOULDEXECUTREPLAN)
  if (shouldExecute) {
    print(header(Prompts.STARTAPPLYEXEC))
  } else {
    print(header(Prompts.CANCELAPPLY))
  }
  return shouldExecute
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

  const updateCurrentAction = (action?: PlanAction): void => {
    if (currentActionPollerID && currentAction && currentActionStartTime) {
      clearInterval(currentActionPollerID)
      print(createActionDoneOutput(currentAction, currentActionStartTime))
    }
    currentAction = action
    if (action) {
      currentActionStartTime = new Date()
      print(createActionStartOutput(action))
      currentActionPollerID = setInterval(pollCurentAction, CURRENT_ACTION_POLL_INTERVAL)
    }
  }

  try {
    const blueprints = await loadBlueprints(
      blueprintsFiles,
      blueprintsDir,
    )
    await core.apply(
      blueprints,
      getConfigFromUser,
      shouldApply,
      updateCurrentAction,
      force
    )
    updateCurrentAction()
  } catch (e) {
    updateCurrentAction()
    printError(e)
  }
}

export const describe = async (
  searchWords: string[]
): Promise<void> => {
  const allElements = await core.getAllElements([])
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
  const outputBP = await core.discover(
    blueprints,
    getConfigFromUser
  )
  outputBP.filename = outputFilename
  await dumpBlueprint(outputBP)
}
