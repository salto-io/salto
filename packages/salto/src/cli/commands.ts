// apply | plan | discover | describe | setenv
import chalk from 'chalk'
import * as inquirer from 'inquirer'
import * as fs from 'async-file'
import * as path from 'path'
import Fuse from 'fuse.js'
import _ from 'lodash'

import {
  PlanAction, PlanActionType, isPrimitiveType, PrimitiveTypes, ElemID,
  isListType, isObjectType, Element, isType, InstanceElement, Type, ObjectType,
} from 'adapter-api'
import Prompts from './prompts'
import {
  SaltoCore, Blueprint,
} from '../core/core'


type OptionalString = string | undefined
type NotFound = null
type ElementMap = Record<string, Element>
interface FoundSearchResult {
  key: string
  element: Element
  isGuess: boolean
}
type SearchResult = FoundSearchResult | NotFound

export default class Cli {
  core: SaltoCore
  currentAction?: PlanAction
  currentActionStartTime?: Date
  currentActionPollerID?: ReturnType<typeof setTimeout>
  currentActionPollerInterval: number = 5000

  constructor(core?: SaltoCore) {
    this.core = core || new SaltoCore({
      getConfigFromUser: Cli.getConfigFromUser,
    })
  }

  private static print(txt: string): void {
    // eslint-disable-next-line no-console
    console.log(txt)
  }

  private static printError(txt: string): void {
    // eslint-disable-next-line no-console
    console.error(chalk.red(txt))
  }

  private static header(txt: string): string {
    return chalk.bold(txt)
  }

  private static subHeader(txt: string): string {
    return chalk.grey(txt)
  }

  private static body(txt: string): string {
    return chalk.reset(txt)
  }

  private static warn(txt: string): string {
    return chalk.red(txt)
  }

  private static emptyLine(): string {
    return ''
  }

  /**
   * Prints a line seperator to the screen
   */
  private static seperator(): string {
    return `\n${'-'.repeat(78)}\n`
  }

  /**
   * Prompts the user for boolean input and returns the result.
   * @param  {string} prompt the text of the question to display to the user
   * @return {Promise<boolean>} A promise with user anwser to the question
   */
  private static async getUserBooleanInput(prompt: string): Promise<boolean> {
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
  private static async getBluePrintsFromDir(
    blueprintsDir: string,
  ): Promise<string[]> {
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
  private static async loadBlueprint(blueprintFile: string): Promise<Blueprint> {
    return {
      buffer: await fs.readFile(blueprintFile, 'utf8'),
      filename: blueprintFile,
    }
  }

  /**
   * Reads all of the blueprints specified by the use by full name, or by providing the directory
   * inwhich they resides.
   * @param  {Array<string>} blueprintsFile An array of pathes to blueprint files to load.
   * @param  {string} A path to the blueprints directory //TODO - Should this also be an array?
   * @return {Promise<Array<string>>} A promise with an array of the bp files content as values
   */
  private static async loadBlueprints(
    blueprintsFiles: string[],
    blueprintsDir?: string,
  ): Promise<Blueprint[]> {
    try {
      let allBlueprintsFiles = blueprintsFiles
      if (blueprintsDir) {
        const dirFiles = await Cli.getBluePrintsFromDir(blueprintsDir)
        allBlueprintsFiles = allBlueprintsFiles.concat(dirFiles)
      }
      const blueprints = allBlueprintsFiles.map(Cli.loadBlueprint)
      return await Promise.all(blueprints)
    } catch (e) {
      throw Error(`Failed to load blueprints files: ${e.message}`)
    }
  }

  /**
   * Write blueprint to file
   * @param blueprint The blueprint to dump
   */
  private static dumpBlueprint(blueprint: Blueprint): Promise<void> {
    return fs.writeFile(blueprint.filename, blueprint.buffer)
  }

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
  private static normalizeValuePrint(value: any): string {
    if (typeof value === 'string') {
      return `"${value}"`
    }
    if (typeof value === 'undefined') {
      return 'undefined'
    }
    if (Array.isArray(value)) {
      return `[${value.map(Cli.normalizeValuePrint)}]`
    }
    return JSON.stringify(value)
  }

  private static createCountPlanActionTypesOutput(plan: PlanAction[]): string {
    const counter = plan.reduce(
      (accumulator, step) => {
        accumulator[step.actionType] += 1
        return accumulator
      },
      {
        [PlanActionType.ADD]: 0,
        [PlanActionType.MODIFY]: 0,
        [PlanActionType.REMOVE]: 0,
      },
    )
    return (
      `${chalk.bold('Plan: ')}${counter[PlanActionType.ADD]} to add`
      + `  ${counter[PlanActionType.MODIFY]} to change`
      + `  ${counter[PlanActionType.REMOVE]} to remove.`
    )
  }

  private static createdActionStepValue(step: PlanAction): string {
    if (step.actionType === PlanActionType.MODIFY) {
      return (
        `${Cli.normalizeValuePrint(step.oldValue)}`
        + ` => ${Cli.normalizeValuePrint(step.newValue)}`
      )
    }
    if (step.actionType === PlanActionType.ADD) {
      return `${Cli.normalizeValuePrint(step.newValue)}`
    }
    return `${Cli.normalizeValuePrint(step.oldValue)}`
  }

  private static createPlanStepTitle(
    step: PlanAction,
    printModifiers?: boolean,
  ): string {
    const modifier = printModifiers ? Prompts.MODIFIERS[step.actionType] : ' '
    const stepDesc = `${modifier} ${step.name}`
    const stepValue = Cli.createdActionStepValue(step)
    return step.subChanges.length > 0
      ? stepDesc
      : [stepDesc, stepValue].join(':')
  }

  private static createPlanStepOutput(
    step: PlanAction,
    printModifiers: boolean,
    identLevel: number = 1,
  ): string {
    const stepTitle = Cli.createPlanStepTitle(step, printModifiers)
    const stepChildren = step.subChanges.map(
      (subChange: PlanAction): string => {
        const printChildModifiers = subChange.actionType === PlanActionType.MODIFY
        return this.createPlanStepOutput(
          subChange,
          printChildModifiers,
          identLevel + 1,
        )
      },
    )

    const allLines = [stepTitle].concat(stepChildren)

    const prefix = '  '.repeat(identLevel)
    return allLines
      .map(line => prefix + line)
      .join('\n')
  }

  private static createPlanStepsOutput(plan: PlanAction[]): string {
    return plan
      .map(step => Cli.createPlanStepOutput(step, true))
      .join('\n\n')
  }

  private static createPlanOutput(plan: PlanAction[]): string {
    const actionCount = Cli.createCountPlanActionTypesOutput(plan)
    const planSteps = Cli.createPlanStepsOutput(plan)
    return [
      Cli.header(Prompts.STARTPLAN),
      Cli.subHeader(Prompts.EXPLAINPLAN),
      Cli.seperator(),
      Cli.subHeader(Prompts.EXPLAINPLANRESULT),
      Cli.emptyLine(),
      planSteps,
      Cli.emptyLine(),
      actionCount,
    ].join('\n')
  }

  /**
   * Create a plan based on the provided blueprints. This is done by invoking the core apply
   * function with the dry run flag set to true.
   * @param  {Array<string>} blueprints an array contaning the content of the blueprints files.
   * @return {Promise} An array containing the plan action objects for the apply that would take
   * place based on the current blueprints and state.
   */
  private async createPlan(blueprints: Blueprint[]): Promise<PlanAction[]> {
    try {
      const plan = await this.core.apply(blueprints, true)
      return plan
    } catch (e) {
      throw Error(`Failed to create plan: ${e.message}`)
    }
  }

  /** ****************************************** */
  /**         Apply private functions          * */
  /** ****************************************** */

  /**
   * A callback used to poll the status of the core's apply method current action, and notify
   * the user on its current status.
   */
  private pollCurentAction(): void {
    // Need to cast to any as TS have issues with date subtruction
    if (this.currentActionStartTime) {
      let elapsed = Math.ceil(
        (new Date().getTime() - this.currentActionStartTime.getTime()) / 1000,
      )
      elapsed -= elapsed % 5
      const action = this.currentAction
      if (action) {
        Cli.print(
          Cli.body(
            `${action.name}: Still ${
              Prompts.STARTACTION[action.actionType]
            }... (${Math.ceil(elapsed)}s elapsed)`,
          ),
        )
      }
    }
  }

  /**
   * A callback for the core's update progress evet, updates stats on the current action
   * taken by the apply step in a class field. After updating the current task, a timer
   * function is created to poll the current task status (elapes time etc.) and notify
   * the user. If action is null, the polling function is cleared.
   * @param {PlanAction} action the action on which the core emitted an event.
   */
  private updateCurrentAction(action?: PlanAction): void {
    if (
      this.currentActionPollerID
      && this.currentAction
      && this.currentActionStartTime
    ) {
      clearInterval(this.currentActionPollerID)
      const elapsed = Math.ceil(
        (new Date().getTime() - this.currentActionStartTime.getTime()) / 1000,
      )
      Cli.print(
        `${this.currentAction.name}: `
          + `${Prompts.ENDACTION[this.currentAction.actionType]} `
          + `completed after ${elapsed}s`,
      )
    }
    this.currentAction = action
    if (action) {
      this.currentActionStartTime = new Date()
      const output = [
        Cli.emptyLine(),
        Cli.body(
          `${action.name}: ${Prompts.STARTACTION[action.actionType]}...`,
        ),
      ].join('\n')
      Cli.print(output)
      this.currentActionPollerID = setInterval(
        () => this.pollCurentAction(),
        this.currentActionPollerInterval,
      )
    }
  }

  /** ****************************************** */
  /**       Describe private functions        * */
  /** ****************************************** */

  private static createElementsMap(elements: Element[]): ElementMap {
    return elements.reduce((accumulator: ElementMap, element: Element) => {
      accumulator[element.elemID.getFullName()] = element
      return accumulator
    }, {})
  }

  private static notifyDescribeNoMatch(): string {
    return Cli.warn(Prompts.DESCRIBE_NOT_FOUND)
  }

  private static notifyDescribeNearMatch(result: FoundSearchResult): string {
    return [
      Cli.header(Prompts.DESCRIBE_NEAR_MATCH),
      Cli.emptyLine(),
      Cli.subHeader(`\t${Prompts.DID_YOU_MEAN} ${chalk.bold(result.key)}?`),
      Cli.emptyLine(),
    ].join('\n')
  }

  private static formatElementDescription(element: Element): string {
    if (isType(element) && element.annotationsValues.description) {
      return [Cli.emptyLine(), element.annotationsValues.description].join('\n')
    }
    return Cli.emptyLine()
  }

  private formatSearchResults(
    result: SearchResult,
    recursionLevel: number = 2,
  ): string {
    if (!(result && result.element)) {
      return Cli.notifyDescribeNoMatch()
    }
    if (result.isGuess) {
      return Cli.notifyDescribeNearMatch(result)
    }
    const { element } = result
    const elementName = element.elemID.getFullName()
    const header = Cli.header(`=== ${elementName} ===`)
    const description = Cli.subHeader(Cli.formatElementDescription(element))
    const elementHCL = Cli.body(this.core.elementToHCL(element, recursionLevel))
    return [header, description, elementHCL].join('\n')
  }

  private static getMatchingElementName(
    searchWord: string,
    elementsNames: string[],
    exactMatchOnly: boolean = true,
  ): OptionalString {
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

  private static skipListElement(element: Element): Element {
    if (isListType(element) && element.elementType) {
      return Cli.skipListElement(element.elementType)
    }
    return element
  }

  private static findElement(
    keyParts: string[],
    topLevelElements: ElementMap,
    searchElements: ElementMap,
    exactMatchOnly: boolean = true,
  ): SearchResult {
    const searchWord = keyParts[0]
    const keyPartsRem = keyParts.slice(1)
    const bestKey = Cli.getMatchingElementName(
      searchWord,
      Object.keys(searchElements),
      exactMatchOnly,
    )

    if (!bestKey) {
      return null
    }

    const bestElemId = Cli.skipListElement(searchElements[bestKey]).elemID
    const bestElement = topLevelElements[bestElemId.getFullName()]
    const isGuess = bestKey !== searchWord
    if (!_.isEmpty(keyPartsRem)) {
      const res = isObjectType(bestElement)
        ? Cli.findElement(
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

  private async executePlan(blueprints: Blueprint[]): Promise<void> {
    try {
      Cli.print(Cli.header(Prompts.STARTAPPLY))
      this.core.on('progress', a => this.updateCurrentAction(a))
      await this.core.apply(blueprints)
      this.updateCurrentAction()
    } catch (e) {
      this.updateCurrentAction()
      throw Error(`Failed to execute plan: ${e.message}`)
    }
  }

  protected static getFieldInputType(field: Type): string {
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

  private static async getConfigFromUser(configType: ObjectType): Promise<InstanceElement> {
    const questions = Object.keys(configType.fields).map(fieldName =>
      ({
        type: Cli.getFieldInputType(configType.fields[fieldName].type),
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
   * 2) Calculting the plan
   * 3) Displaying the plan to the user
   * @param  {Array<string>} blueprintsFiles an array of pathes to blueprints files
   * @param  {string} blueprintsDir (Optional) a directory containing blueprints files.
   * @return {Promise<void>} A promise indicating a sucssus, or a reject with
   * an informative error message.
   */
  async plan(blueprintsFiles: string[], blueprintsDir?: string): Promise<void> {
    try {
      const blueprints = await Cli.loadBlueprints(
        blueprintsFiles,
        blueprintsDir,
      )
      const plan = await this.createPlan(blueprints)
      const output = [
        Cli.createPlanOutput(plan),
        Cli.subHeader(Prompts.PLANDISCLAIMER),
      ].join('\n')
      Cli.print(output)
    } catch (e) {
      Cli.printError(e)
    }
  }

  /**
   * Executes the apply action by:
   * 1) Loading the blueprints
   * 2) Calculting the plan
   * 3) Displaying the plan to the user
   * 4) Getting the user approval to execute the plan
   * 5) Execute the plan by invoking the apply method.
   * @param  {Array<string>} blueprintsFiles an array of pathes to blueprints files
   * @param  {string} blueprintsDir (Optional) a directory containing blueprints files.
   * @return {Promise<void>} A promise indicating a sucssus, or a reject with
   * an informative error message.
   */
  async apply(
    blueprintsFiles: string[],
    blueprintsDir?: string,
    force?: boolean,
  ): Promise<void> {
    try {
      const blueprints = await Cli.loadBlueprints(
        blueprintsFiles,
        blueprintsDir,
      )
      const plan = await this.createPlan(blueprints)
      const planOutput = [
        Cli.header(Prompts.STARTAPPLY),
        Cli.subHeader(Prompts.EXPLAINAPPLY),
        Cli.createPlanOutput(plan),
      ].join('\n')
      Cli.print(planOutput)
      const shouldExecute = force || (await Cli.getUserBooleanInput(Prompts.SHOULDEXECUTREPLAN))
      if (shouldExecute) {
        Cli.print(Cli.header(Prompts.STARTAPPLYEXEC))
        await this.executePlan(blueprints)
      } else {
        Cli.print(Cli.header(Prompts.CANCELAPPLY))
      }
    } catch (e) {
      Cli.printError(e)
    }
  }

  async describe(
    searchWords: string[],
    recursionLevel: number = 2,
  ): Promise<void> {
    const allElements = await this.core.getAllElements([])
    const elementsMap = Cli.createElementsMap(allElements)
    // First we try with exact match only
    const searchResult = Cli.findElement(searchWords, elementsMap, elementsMap)
      // Then we allow near matches
      || Cli.findElement(searchWords, elementsMap, elementsMap, false)
    Cli.print(this.formatSearchResults(searchResult, recursionLevel))
  }

  // eslint-disable-next-line class-methods-use-this
  async setenv(): Promise<void> {
    Cli.print('setenv!')
  }

  async discover(
    outputFilename: string,
    blueprintsFiles: string[],
    blueprintsDir?: string,
  ): Promise<void> {
    const blueprints = await Cli.loadBlueprints(
      blueprintsFiles,
      blueprintsDir,
    )
    const outputBP = await this.core.discover(blueprints)
    outputBP.filename = outputFilename
    await Cli.dumpBlueprint(outputBP)
  }
}
