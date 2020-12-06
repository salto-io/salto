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
import glob from 'glob'
import { Plan, telemetrySender, preview, loadLocalWorkspace } from '@salto-io/core'
import { parser, Workspace, WorkspaceComponents } from '@salto-io/workspace'
import { readTextFile, writeFile } from '@salto-io/file'
import _ from 'lodash'
import {
  ActionName, Change, ElemID, getChangeElement, InstanceElement, ObjectType, Values,
  Element, TypeMap,
} from '@salto-io/adapter-api'
import {
  findElement,
} from '@salto-io/adapter-utils'
import { action as fetchAction } from '../../src/commands/fetch'
import { mockSpinnerCreator, MockWriteStream } from '../../test/mocks'
import { CliOutput, CliExitCode, CliTelemetry } from '../../src/types'
import { loadWorkspace } from '../../src/workspace/workspace'
import { action as deployAction } from '../../src/commands/deploy'
import { addAction, loginAction } from '../../src/commands/service'
import { action as initAction } from '../../src/commands/init'
import { createAction, setAction, deleteAction } from '../../src/commands/env'
import { action as cleanAction } from '../../src/commands/clean'

declare global {
  // eslint-disable-next-line
  module jest {
    interface Matchers<R> {
      toExist(): jest.CustomMatcherResult
    }
  }
}

const quote = (s: string): string => `"${s}"`
const filenameList = (l: string[]): string => l.map(quote).join(', ')

expect.extend({
  toExist: function toExist(this: jest.MatcherContext, pattern: string) {
    const resolved = glob.sync(pattern)
    const pass = resolved.length !== 0
    return {
      pass,
      message: () => `file ${quote(pattern)} ${
        pass
          ? `exists${resolved.length > 1 || pattern !== resolved[0] ? `: ${filenameList(resolved)}` : ''}`
          : 'does not exist'
      }`,
    }
  },
})

export type ReplacementPair = [string | RegExp, string]

const { parse } = parser
const services = ['salesforce']

const mockCliOutput = (): CliOutput =>
  ({ stdout: new MockWriteStream(), stderr: new MockWriteStream() })

const config = { shouldCalcTotalSize: true }

const cliTelemetry: CliTelemetry = {
  start: () => jest.fn(),
  failure: () => jest.fn(),
  success: () => jest.fn(),
  mergeErrors: () => jest.fn(),
  changes: () => jest.fn(),
  changesToApply: () => jest.fn(),
  errors: () => jest.fn(),
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

export const runAddSalesforceService = async (workspacePath: string): Promise<void> => {
  await addAction({
    input: {
      login: true,
      serviceName: 'salesforce',
      authType: 'basic',
    },
    config,
    output: mockCliOutput(),
    cliTelemetry,
    workspacePath,
  })
}

export const runSalesforceLogin = async (workspacePath: string): Promise<void> => {
  await loginAction({
    input: {
      serviceName: 'salesforce',
      authType: 'basic',
    },
    cliTelemetry,
    config,
    output: mockCliOutput(),
    workspacePath,
  })
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
  workspacePath: string,
  baseDir?: string
): Promise<void> => {
  const origDir = process.cwd()
  if (baseDir) {
    process.chdir(baseDir)
  }
  await initAction({
    input: {
      workspaceName: workspacePath,
    },
    cliTelemetry,
    config,
    output: mockCliOutput(),
    workspacePath,
  })
  if (baseDir) {
    process.chdir(origDir)
  }
}

export const runCreateEnv = async (
  workspacePath: string,
  envName: string,
  force?: boolean,
): Promise<void> => {
  await createAction({
    input: {
      envName,
      force,
    },
    config,
    cliTelemetry,
    output: mockCliOutput(),
    workspacePath,
  })
}

export const runSetEnv = async (workspacePath: string, envName: string): Promise<void> => {
  await setAction({
    input: {
      envName,
    },
    config,
    cliTelemetry,
    output: mockCliOutput(),
    workspacePath,
  })
}

export const runDeleteEnv = async (workspacePath: string, envName: string): Promise<void> => {
  await deleteAction({
    input: {
      envName,
    },
    config,
    cliTelemetry,
    output: mockCliOutput(),
    workspacePath,
  })
}

export const getCurrentEnv = async (workspacePath: string): Promise<string> => {
  const workspace = await loadLocalWorkspace(workspacePath)
  return workspace.currentEnv()
}

export const runFetch = async (
  fetchOutputDir: string,
  isolated = false,
  inputEnvironment?: string,
): Promise<void> => {
  const result = await fetchAction({
    input: {
      services,
      env: inputEnvironment,
      mode: isolated ? 'isolated' : 'override',
      force: true,
      interactive: false,
      stateOnly: false,
    },
    config,
    cliTelemetry,
    output: mockCliOutput(),
    workspacePath: fetchOutputDir,
  })
  expect(result).toEqual(CliExitCode.Success)
}

export const runDeploy = async ({
  lastPlan,
  fetchOutputDir,
  allowErrors = false,
  force = true,
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
  const result = await deployAction({
    input: {
      force,
      dryRun,
      detailedPlan,
      services,
    },
    config,
    cliTelemetry,
    output: mockCliOutput(),
    spinnerCreator: mockSpinnerCreator([]),
    workspacePath: fetchOutputDir,
  })
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
  runDeploy({ fetchOutputDir, allowErrors: false, dryRun: true })
)

export const runClean = async (
  workspaceName: string,
  cleanArgs: WorkspaceComponents,
): Promise<void> => {
  await cleanAction({
    input: {
      ...cleanArgs,
      force: true,
    },
    config,
    cliTelemetry,
    output: mockCliOutput(),
    workspacePath: workspaceName,
  })
}

export const loadValidWorkspace = async (
  fetchOutputDir: string,
  force = true
): Promise<Workspace> => {
  const { workspace, errored } = await loadWorkspace(fetchOutputDir, mockCliOutput(), { force })
  expect(errored).toBeFalsy()
  return workspace
}

export const runPreviewGetPlan = async (fetchOutputDir: string): Promise<Plan | undefined> => {
  const workspace = await loadValidWorkspace(fetchOutputDir)
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
    expect(object.annotationRefTypes[key]).toEqual(value.elemID))
  Object.entries(expectedAnnotations).forEach(([key, value]) =>
    expect(object.annotations[key]).toEqual(value))
  Object.entries(expectedFieldAnnotations).forEach(([fieldName, fieldAnnotation]) => {
    expect(object.fields[fieldName].annotations[fieldAnnotation[0]]).toEqual(fieldAnnotation[1])
  })
  return object
}
