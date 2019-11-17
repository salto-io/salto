import { file, Plan, Workspace } from 'salto'
import { exists } from 'salto/dist/src/file'
import _ from 'lodash'
import { ActionName, Change, getChangeElement, InstanceElement, ObjectType } from 'adapter-api'
import wu from 'wu'
import {
  SalesforceClient,
  testHelpers as salesforceTestHelpers,
  testTypes as salesforceTestTypes,
} from 'salesforce-adapter'
import { command as fetch } from '../src/commands/fetch'
import { mockSpinnerCreator, MockWriteStream } from '../test/mocks'
import { CliOutput } from '../src/types'
import { loadWorkspace } from '../src/workspace'
import { DeployCommand } from '../src/commands/deploy'
import { command as preview } from '../src/commands/preview'

export type Pair = [string, string]

export const editBlueprint = async (filename: string, replacements: Pair[]): Promise<void> => {
  let fileAsString = await file.readTextFile(filename)
  replacements.forEach(pair => {
    fileAsString = fileAsString.replace(pair[0], pair[1])
  })
  await file.writeTextFile(filename, fileAsString)
}

const mockCliOutput = (): CliOutput =>
  ({ stdout: new MockWriteStream(), stderr: new MockWriteStream() })

export const runFetch = async (statePath: string, fetchOutputDir: string): Promise<void> => {
  await fetch(fetchOutputDir, true, false, mockCliOutput(), mockSpinnerCreator([])).execute()
  expect(await exists(fetchOutputDir)).toBe(true)
  expect(await exists(statePath)).toBe(true)
}

export const runDeploy = async (lastPlan: Plan, fetchOutputDir: string): Promise<void> => {
  if (lastPlan) {
    lastPlan.clear()
  }
  await new DeployCommand(fetchOutputDir, false, mockCliOutput(), mockSpinnerCreator([])).execute()
}

export const runEmptyPreview = async (lastPlan: Plan, fetchOutputDir: string): Promise<void> => {
  if (lastPlan) {
    lastPlan.clear()
  }
  await preview(fetchOutputDir, mockCliOutput(), mockSpinnerCreator([])).execute()
  expect(_.isEmpty(lastPlan)).toBeTruthy()
}

export const loadValidWorkspace = async (fetchOutputDir: string): Promise<Workspace> => {
  const { workspace, errored } = await loadWorkspace(fetchOutputDir, mockCliOutput())
  expect(errored).toBeFalsy()
  return workspace
}

const getChangedElementName = (change: Change): string => getChangeElement(change).elemID.name

export const verifyChanges = (plan: Plan, changesAction: ActionName,
  expectedElementNames: string[]): void => {
  expect(plan.size).toBe(expectedElementNames.length)
  const changes = wu(plan.itemsByEvalOrder()).map(item => item.parent() as Change).toArray()
  changes.forEach(change => expect(change.action).toBe(changesAction))
  expect(changes.map(change => getChangedElementName(change)).sort())
    .toEqual(expectedElementNames.sort())
}

export const objectExists = async (client: SalesforceClient, name: string, fields: string[] = [],
  missingFields: string[] = []): Promise<boolean> => {
  const result = (
    await client.readMetadata(salesforceTestHelpers.CUSTOM_OBJECT, name)
  )[0] as salesforceTestTypes.CustomObject
  if (!result || !result.fullName) {
    return false
  }
  let fieldNames: string[] = []
  if (result.fields) {
    fieldNames = _.isArray(result.fields) ? result.fields.map(rf => rf.fullName)
      : [result.fields.fullName]
  }
  if (fields && !fields.every(f => fieldNames.includes(f))) {
    return false
  }
  return (!missingFields || missingFields.every(f => !fieldNames.includes(f)))
}

export const instanceExists = async (client: SalesforceClient, type: string, name: string,
  expectedValues?: Pair[]): Promise<boolean> => {
  const result = (await client.readMetadata(type, name))[0]
  if (!result || !result.fullName) {
    return false
  }
  if (expectedValues) {
    return expectedValues.every(pair => _.get(result, pair[0]) === pair[1])
  }
  return true
}

const findTestObject = (workspace: Workspace, name: string): ObjectType =>
  wu(workspace.elements)
    .find(elem => elem.elemID.name === name) as ObjectType

const findTestInstance = (workspace: Workspace, name: string): InstanceElement =>
  wu(workspace.elements)
    .find(elem => elem.elemID.name === name) as InstanceElement

export const verifyNewInstanceBP = (workspace: Workspace, name: string,
  expectedValues: Pair[]): void => {
  const newInstance = findTestInstance(workspace, name)
  expectedValues.forEach(pair =>
    expect(newInstance.value[pair[0]]).toEqual(pair[1]))
}

export const verifyNewObjectBP = (workspace: Workspace, name: string, expectedAnnotations: Pair[],
  expectedFieldAnnotations: Record<string, Pair>): void => {
  const newObject = findTestObject(workspace, name)
  expectedAnnotations.forEach(pair =>
    expect(newObject.annotations[pair[0]]).toEqual(pair[1]))
  Object.entries(expectedFieldAnnotations).forEach(fieldNameToAnnotations => {
    const fieldName = fieldNameToAnnotations[0]
    const fieldAnnotations = fieldNameToAnnotations[1]
    expect(newObject.fields[fieldName].annotations[fieldAnnotations[0]])
      .toEqual(fieldAnnotations[1])
  })
}
