import { file, Plan, Workspace } from 'salto'
import _ from 'lodash'
import {
  ActionName, Change, ElemID, findElement, getChangeElement, InstanceElement, ObjectType, Values,
} from 'adapter-api'
import wu from 'wu'
import { command as fetch } from '../../src/commands/fetch'
import adapterConfigs from '../adapter_configs'
import { mockSpinnerCreator, MockWriteStream } from '../../test/mocks'
import { CliOutput } from '../../src/types'
import { loadWorkspace } from '../../src/workspace'
import { DeployCommand } from '../../src/commands/deploy'
import { command as preview } from '../../src/commands/preview'
import { command as servicesCommand } from '../../src/commands/services'

export type Pair = [string, string]

const services = ['salesforce']

const getSalesforceConfig = (): Promise<InstanceElement> =>
  Promise.resolve(adapterConfigs.salesforce())

const mockCliOutput = (): CliOutput =>
  ({ stdout: new MockWriteStream(), stderr: new MockWriteStream() })

export const runSalesforceLogin = async (workspaceDir: string): Promise<void> => {
  await servicesCommand(workspaceDir, 'login', mockCliOutput(), getSalesforceConfig, 'salesforce')
    .execute()
}

export const editBlueprint = async (filename: string, replacements: Pair[]): Promise<void> => {
  let fileAsString = await file.readTextFile(filename)
  replacements.forEach(pair => {
    fileAsString = fileAsString.replace(pair[0], pair[1])
  })
  await file.writeFile(filename, fileAsString)
}

export const runFetch = async (fetchOutputDir: string): Promise<void> => {
  await fetch(fetchOutputDir, true, false, mockCliOutput(), mockSpinnerCreator([]), services)
    .execute()
}

export const runDeploy = async (lastPlan: Plan, fetchOutputDir: string): Promise<void> => {
  if (lastPlan) {
    lastPlan.clear()
  }
  await new DeployCommand(
    fetchOutputDir,
    false,
    services,
    mockCliOutput(),
    mockSpinnerCreator([])
  ).execute()
}

export const runEmptyPreview = async (lastPlan: Plan, fetchOutputDir: string): Promise<void> => {
  if (lastPlan) {
    lastPlan.clear()
  }
  await preview(fetchOutputDir, mockCliOutput(), mockSpinnerCreator([]), services).execute()
  expect(_.isEmpty(lastPlan)).toBeTruthy()
}

export const loadValidWorkspace = async (fetchOutputDir: string): Promise<Workspace> => {
  const { workspace, errored } = await loadWorkspace(fetchOutputDir, mockCliOutput())
  expect(errored).toBeFalsy()
  return workspace
}

const getChangedElementName = (change: Change): string => getChangeElement(change).elemID.name

export const verifyChanges = (plan: Plan,
  expectedChanges: { action: ActionName; element: string }[]): void => {
  expect(plan.size).toBe(expectedChanges.length)
  const changes = wu(plan.itemsByEvalOrder()).map(item => item.parent() as Change).toArray()
  expect(changes.every(change =>
    expectedChanges.some(expectedChange =>
      change.action === expectedChange.action
      && getChangedElementName(change) === expectedChange.element))).toBeTruthy()
}

const findObject = (workspace: Workspace, adapter: string, name: string): ObjectType =>
  findElement(workspace.elements, new ElemID(adapter, name)) as ObjectType

const findInstance = (workspace: Workspace, adapter: string, typeName: string,
  name: string): InstanceElement =>
  findElement(workspace.elements,
    new ElemID(adapter, typeName, 'instance', name)) as InstanceElement

export const verifyInstance = (workspace: Workspace, adapter: string, typeName: string,
  name: string, expectedValues: Values): void => {
  const newInstance = findInstance(workspace, adapter, typeName, name)
  Object.entries(expectedValues).forEach(entry =>
    expect(newInstance.value[entry[0]]).toEqual(entry[1]))
}

export const verifyObject = (workspace: Workspace, adapter: string, name: string,
  expectedAnnotations: Values, expectedFieldAnnotations: Record<string, Values>): void => {
  const newObject = findObject(workspace, adapter, name)
  Object.entries(expectedAnnotations).forEach(entry =>
    expect(newObject.annotations[entry[0]]).toEqual(entry[1]))
  Object.entries(expectedFieldAnnotations).forEach(fieldNameToAnnotations => {
    const fieldName = fieldNameToAnnotations[0]
    const fieldAnnotations = fieldNameToAnnotations[1]
    expect(newObject.fields[fieldName].annotations[fieldAnnotations[0]])
      .toEqual(fieldAnnotations[1])
  })
}
