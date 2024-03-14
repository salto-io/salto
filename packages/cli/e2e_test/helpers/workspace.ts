/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { Plan, telemetrySender, preview, loadLocalWorkspace, AppConfig } from '@salto-io/core'
import { Workspace, WorkspaceComponents } from '@salto-io/workspace'
import { parser } from '@salto-io/parser'
import { readTextFile, writeFile } from '@salto-io/file'
import {
  ActionName,
  Change,
  ElemID,
  getChangeData,
  InstanceElement,
  ObjectType,
  Values,
  Element,
  TypeMap,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { findElement } from '@salto-io/adapter-utils'
import commandDefs from '../../src/commands'
import cli from '../../src/cli'
import { mockSpinnerCreator, MockWriteStream } from '../../test/mocks'
import { CliOutput, CliExitCode } from '../../src/types'
import { validateWorkspace } from '../../src/workspace/workspace'

const { awu } = collections.asynciterable
declare global {
  // eslint-disable-next-line
  module jest {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      message: () =>
        `file ${quote(pattern)} ${
          pass
            ? `exists${resolved.length > 1 || pattern !== resolved[0] ? `: ${filenameList(resolved)}` : ''}`
            : 'does not exist'
        }`,
    }
  },
})

export type ReplacementPair = [string | RegExp, string]

const { parse } = parser

const mockCliOutput = (): CliOutput => ({ stdout: new MockWriteStream(), stderr: new MockWriteStream() })

const config: AppConfig = {
  installationID: 'abcd',
  telemetry: {
    enabled: false,
    token: '1234',
    url: 'http://0.0.0.0',
  },
  command: { shouldCalcTotalSize: true },
}

const telemetry = telemetrySender(
  { url: 'http://0.0.0.0', token: '1234', enabled: false },
  { installationID: 'abcd', app: 'test' },
)

export const cleanup = async (): Promise<void> => telemetry.stop(0)

export const editNaclFile = async (filename: string, replacements: ReplacementPair[]): Promise<void> => {
  let fileAsString = await readTextFile(filename)
  replacements.forEach(pair => {
    fileAsString = fileAsString.replace(pair[0], pair[1])
  })
  await writeFile(filename, fileAsString)
}

export const getNaclFileElements = async (filename: string): Promise<Element[]> => {
  const fileAsString = await readTextFile(filename)
  return awu((await parse(Buffer.from(fileAsString), filename)).elements).toArray()
}

const runCommand = ({
  workspacePath,
  args,
  cliOutput,
}: {
  workspacePath: string
  args: string[]
  cliOutput?: CliOutput
}): Promise<CliExitCode> =>
  cli({
    input: {
      args,
      config: config.command,
      telemetry,
    },
    commandDefs,
    workspacePath,
    output: cliOutput ?? mockCliOutput(),
    spinnerCreator: mockSpinnerCreator([]),
  })

export const runInit = async (workspaceName: string, workspacePath: string): Promise<void> => {
  await runCommand({
    workspacePath,
    args: ['init', workspaceName],
  })
}

export const runAddSalesforceService = async (workspacePath: string, accountName?: string): Promise<void> => {
  await runCommand({
    workspacePath,
    args: accountName
      ? ['account', 'add', 'salesforce', '--account-name', accountName]
      : ['account', 'add', 'salesforce'],
  })
}

export const runSalesforceLogin = async (workspacePath: string, accountName: string): Promise<void> => {
  await runCommand({
    workspacePath,
    args: ['account', 'login', accountName],
  })
}

export const runCreateEnv = async (workspacePath: string, envName: string, force?: boolean): Promise<void> => {
  await runCommand({
    workspacePath,
    args: ['env', 'create', envName, ...(force ? ['-f'] : [])],
  })
}

export const runSetEnv = async (workspacePath: string, envName: string): Promise<void> => {
  await runCommand({
    workspacePath,
    args: ['env', 'set', envName],
  })
}

export const runDeleteEnv = async (workspacePath: string, envName: string): Promise<void> => {
  await runCommand({
    workspacePath,
    args: ['env', 'delete', envName],
  })
}

export const getCurrentEnv = async (workspacePath: string): Promise<string> => {
  const workspace = await loadLocalWorkspace({ path: workspacePath })
  return workspace.currentEnv()
}

export const runFetch = async (
  fetchOutputDir: string,
  isolated = false,
  inputEnvironment?: string,
  configOverrides?: string[],
): Promise<void> => {
  const result = await runCommand({
    workspacePath: fetchOutputDir,
    args: [
      'fetch',
      '-f',
      ...(inputEnvironment ? ['-e', inputEnvironment] : []),
      '-m',
      isolated ? 'isolated' : 'override',
      ...(configOverrides ?? [])
        // Temporary workaround until https://salto-io.atlassian.net/browse/SALTO-5544 is implemented
        .concat([
          'salesforce.fetch.optionalFeatures.hideTypesFolder=false',
          'e2esalesforce.fetch.optionalFeatures.hideTypesFolder=false',
        ])
        .flatMap(override => ['-C', override]),
    ],
  })
  expect(result).toEqual(CliExitCode.Success)
}

export const runDeploy = async ({
  workspacePath,
  allowErrors = false,
}: {
  workspacePath: string
  allowErrors?: boolean
}): Promise<void> => {
  const cliOutput = mockCliOutput()
  const result = await runCommand({
    args: ['deploy', '-f'],
    workspacePath,
    cliOutput,
  })
  const errs = (cliOutput.stderr as MockWriteStream).content
  // This assert is before result assert so will see the error
  // This is not a mistake, we will have errors on some deployments
  // with delete changes, and its expected.
  if (!allowErrors) {
    expect(errs).toHaveLength(0)
    expect(result).toBe(CliExitCode.Success)
  }
}

export const runClean = async ({
  workspacePath,
  cleanArgs,
}: {
  workspacePath: string
  cleanArgs: Partial<WorkspaceComponents>
}): Promise<CliExitCode> => {
  const options = [
    ...(cleanArgs.nacl === false ? ['--no-nacl'] : []),
    ...(cleanArgs.state === false ? ['--no-state'] : []),
    ...(cleanArgs.cache === false ? ['--no-cache'] : []),
    ...(cleanArgs.staticResources === false ? ['--no-static-resources'] : []),
    ...(cleanArgs.credentials ? ['--credentials'] : []),
    ...(cleanArgs.accountConfig ? ['--account-config'] : []),
  ]
  return runCommand({
    workspacePath,
    args: ['workspace', 'clean', '-f', ...options],
  })
}

export const loadValidWorkspace = async (fetchOutputDir: string): Promise<Workspace> => {
  const workspace = await loadLocalWorkspace({ path: fetchOutputDir })
  const { errors } = await validateWorkspace(workspace)
  expect(errors).toHaveLength(0)
  return workspace
}

export const runPreviewGetPlan = async (fetchOutputDir: string, accounts?: string[]): Promise<Plan> => {
  const workspace = await loadLocalWorkspace({ path: fetchOutputDir })
  return preview(workspace, accounts)
}

const getChangedElementName = (change: Change): string => getChangeData(change).elemID.name

type ExpectedChange = { action: ActionName; element: string }
export const verifyChanges = (plan: Plan, expectedChanges: ExpectedChange[]): void => {
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

  expect(changes).toEqual(expectedChanges.sort(compareChanges))
}

export const runEmptyPreview = async (fetchOutputDir: string, accounts?: string[]): Promise<void> => {
  const plan = await runPreviewGetPlan(fetchOutputDir, accounts)
  verifyChanges(plan, [])
}

const findInstance = (
  elements: ReadonlyArray<Element>,
  adapter: string,
  typeName: string,
  name: string,
): InstanceElement => findElement(elements, new ElemID(adapter, typeName, 'instance', name)) as InstanceElement

export const verifyInstance = async (
  elements: AsyncIterable<Element>,
  adapter: string,
  typeName: string,
  name: string,
  expectedValues: Values,
): Promise<void> => {
  const newInstance = findInstance(await awu(elements).toArray(), adapter, typeName, name)
  Object.entries(expectedValues).forEach(([key, value]) => expect(newInstance.value[key]).toEqual(value))
}

export const verifyObject = async (
  elements: Element[],
  adapter: string,
  typeName: string,
  expectedAnnotationTypes: TypeMap,
  expectedAnnotations: Values,
  expectedFieldAnnotations: Record<string, Values>,
): Promise<ObjectType> => {
  const object = findElement(await awu(elements).toArray(), new ElemID(adapter, typeName)) as ObjectType
  Object.entries(expectedAnnotationTypes).forEach(([key, value]) =>
    expect(object.annotationRefTypes[key].elemID).toEqual(value.elemID),
  )
  Object.entries(expectedAnnotations).forEach(([key, value]) => expect(object.annotations[key]).toEqual(value))
  Object.entries(expectedFieldAnnotations).forEach(([fieldName, fieldAnnotation]) => {
    expect(object.fields[fieldName].annotations[fieldAnnotation[0]]).toEqual(fieldAnnotation[1])
  })
  return object
}
