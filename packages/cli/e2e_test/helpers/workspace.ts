/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { Plan, telemetrySender, preview, loadLocalWorkspace } from '@salto-io/core'
import { parser, Workspace } from '@salto-io/workspace'
import { readTextFile, writeFile } from '@salto-io/file'
import _ from 'lodash'
import glob from 'glob'
import {
  ActionName, Change, ElemID, getChangeElement, InstanceElement, ObjectType, Values,
  Element, TypeMap,
} from '@salto-io/adapter-api'
import {
  findElement,
} from '@salto-io/adapter-utils'
import { command as fetch } from '../../src/commands/fetch'
import { mockSpinnerCreator, MockWriteStream } from '../../test/mocks'
import { CliOutput, CliExitCode, CliTelemetry } from '../../src/types'
import { loadWorkspace } from '../../src/workspace/workspace'
import { DeployCommand } from '../../src/commands/deploy'
import { command as servicesCommand } from '../../src/commands/services'
import { command as initCommand } from '../../src/commands/init'
import { command as envCommand } from '../../src/commands/env'
import { getCliTelemetry } from '../../src/telemetry'

export type ReplacementPair = [string | RegExp, string]

const { parse } = parser
const services = ['salesforce']

const mockCliOutput = (): CliOutput =>
  ({ stdout: new MockWriteStream(), stderr: new MockWriteStream() })

const mockCliTelementy: CliTelemetry = {
  start: () => jest.fn(),
  failure: () => jest.fn(),
  success: () => jest.fn(),
  mergeErrors: () => jest.fn(),
  changes: () => jest.fn(),
  changesToApply: () => jest.fn(),
  errors: () => jest.fn(),
  failedRows: () => jest.fn(),
  actionsSuccess: () => jest.fn(),
  actionsFailure: () => jest.fn(),
  workspaceSize: () => jest.fn(),
  stacktrace: () => jest.fn(),
}

const telemetry = telemetrySender(
  { url: 'http://0.0.0.0', token: '1234', enabled: false },
  { installationID: 'abcd', app: 'test' },
)

export const cleanup = async (): Promise<void> => telemetry.stop(0)

export const runAddSalesforceService = async (
  workspaceDir: string, credentials: InstanceElement
): Promise<void> => {
  await servicesCommand(
    workspaceDir,
    'add',
    mockCliOutput(),
    () => Promise.resolve(credentials),
    'salesforce'
  ).execute()
}

export const runSalesforceLogin = async (
  workspaceDir: string,
  sfCredsInstance: InstanceElement
): Promise<void> => {
  await servicesCommand(
    workspaceDir,
    'login',
    mockCliOutput(),
    () => Promise.resolve(sfCredsInstance),
    'salesforce'
  ).execute()
}

export const editNaclFile = async (filename: string, replacements: ReplacementPair[]):
  Promise<void> => {
  let fileAsString = await readTextFile(filename)
  replacements.forEach(pair => {
    fileAsString = fileAsString.replace(pair[0], pair[1])
  })
  await writeFile(filename, fileAsString)
}

export const getNaclFileElements = async (filename: string):
  Promise<Element[]> => {
  const fileAsString = await readTextFile(filename)
  return (await parse(Buffer.from(fileAsString), filename)).elements
}

export const runInit = async (
  workspaceName: string,
  defaultEnvName: string,
  baseDir?: string
): Promise<void> => {
  const origDir = process.cwd()
  if (baseDir) {
    process.chdir(baseDir)
  }
  await initCommand(
    workspaceName,
    mockCliTelementy,
    mockCliOutput(),
    jest.fn().mockResolvedValue(defaultEnvName)
  ).execute()
  if (baseDir) {
    process.chdir(origDir)
  }
}

export const runCreateEnv = async (workspaceDir: string, envName: string): Promise<void> => {
  await envCommand(workspaceDir, 'create', mockCliOutput(), envName).execute()
}

export const runSetEnv = async (workspaceDir: string, envName: string): Promise<void> => {
  await envCommand(workspaceDir, 'set', mockCliOutput(), envName).execute()
}

export const getCurrentEnv = async (workspaceDir: string): Promise<string> => {
  const workspace = await loadLocalWorkspace(workspaceDir)
  return workspace.currentEnv()
}

export const runFetch = async (
  fetchOutputDir: string,
  isolated = false,
  inputEnvironment?: string,
): Promise<void> => {
  await fetch(
    fetchOutputDir,
    true,
    false,
    telemetry,
    mockCliOutput(),
    mockSpinnerCreator([]),
    isolated,
    true,
    services,
    inputEnvironment,
  ).execute()
}


export const runDeploy = async ({
  lastPlan,
  fetchOutputDir,
  allowErrors = false,
  force = false,
  dryRun = false,
  detailedPlan = false,
}: {
  lastPlan?: Plan | undefined
  fetchOutputDir: string
  allowErrors?: boolean
  force?: boolean
  dryRun?: boolean
  detailedPlan?: boolean
}): Promise<void> => {
  if (lastPlan) {
    lastPlan.clear()
  }
  const output = mockCliOutput()
  const result = await new DeployCommand(
    fetchOutputDir,
    force,
    dryRun,
    detailedPlan,
    getCliTelemetry(telemetry, 'deploy'),
    output,
    mockSpinnerCreator([]),
    services
  ).execute()
  const errs = (output.stderr as MockWriteStream).content
  // This assert is before result assert so will see the error
  // This is not a mistake, we will have errors on some deployments
  // with delete changes, and its expected.
  if (!allowErrors) {
    expect(errs).toHaveLength(0)
    expect(result).toBe(CliExitCode.Success)
  }
}

export const runPreview = async (fetchOutputDir: string): Promise<void> => (
  // using force=true to avoid a user prompt
  runDeploy({ fetchOutputDir, allowErrors: false, force: true, dryRun: true })
)

export const loadValidWorkspace = async (
  fetchOutputDir: string,
  force = false
): Promise<Workspace> => {
  const { workspace, errored } = await loadWorkspace(fetchOutputDir, mockCliOutput(), { force })
  expect(errored).toBeFalsy()
  return workspace
}

export const runPreviewGetPlan = async (fetchOutputDir: string): Promise<Plan | undefined> => {
  // using force=true because there are workspace warnings
  const workspace = await loadValidWorkspace(fetchOutputDir, true /* force */)
  return preview(workspace, services)
}

export const runEmptyPreview = async (lastPlan: Plan, fetchOutputDir: string): Promise<void> => {
  if (lastPlan) {
    lastPlan.clear()
  }
  await runPreview(fetchOutputDir)
  expect(_.isEmpty(lastPlan)).toBeTruthy()
}

const getChangedElementName = (change: Change): string => getChangeElement(change).elemID.name

type ExpectedChange = { action: ActionName; element: string }
export const verifyChanges = (plan: Plan,
  expectedChanges: ExpectedChange[]): void => {
  const compareChanges = (a: ExpectedChange, b: ExpectedChange): number => {
    if (a.action !== b.action) {
      return a.action > b.action ? 1 : -1
    }
    if (a.element !== b.element) {
      return a.element > b.element ? 1 : -1
    }
    return 0
  }

  const changes = [...plan.itemsByEvalOrder()]
    .flatMap(item => [...item.changes()])
    .map(change => ({ action: change.action, element: getChangedElementName(change) }))
    .sort(compareChanges)

  expect(expectedChanges.sort(compareChanges)).toEqual(changes)
}

const findInstance = (elements: ReadonlyArray<Element>, adapter: string, typeName: string,
  name: string): InstanceElement =>
  findElement(elements,
    new ElemID(adapter, typeName, 'instance', name)) as InstanceElement

export const verifyInstance = (elements: ReadonlyArray<Element>, adapter: string, typeName: string,
  name: string, expectedValues: Values): void => {
  const newInstance = findInstance(elements, adapter, typeName, name)
  Object.entries(expectedValues).forEach(([key, value]) =>
    expect(newInstance.value[key]).toEqual(value))
}

export const verifyObject = (elements: ReadonlyArray<Element>, adapter: string, typeName: string,
  expectedAnnotationTypes: TypeMap, expectedAnnotations: Values,
  expectedFieldAnnotations: Record<string, Values>): ObjectType => {
  const object = findElement(elements, new ElemID(adapter, typeName)) as ObjectType
  Object.entries(expectedAnnotationTypes).forEach(([key, value]) =>
    expect(object.annotationTypes[key]).toEqual(value))
  Object.entries(expectedAnnotations).forEach(([key, value]) =>
    expect(object.annotations[key]).toEqual(value))
  Object.entries(expectedFieldAnnotations).forEach(([fieldName, fieldAnnotation]) => {
    expect(object.fields[fieldName].annotations[fieldAnnotation[0]]).toEqual(fieldAnnotation[1])
  })
  return object
}

export const ensureFilesExist = (filePathes: string[]): boolean => (
  _.every(filePathes.map(filename => !_.isEmpty(glob.sync(filename))))
)

export const ensureFilesDontExist = (filePathes: string[]): boolean => (
  _.every(filePathes.map(filename => _.isEmpty(glob.sync(filename))))
)
