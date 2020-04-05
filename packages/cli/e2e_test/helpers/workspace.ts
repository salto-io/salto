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
import { file, Plan, Workspace, telemetrySender } from '@salto-io/core'
import _ from 'lodash'
import {
  ActionName, Change, ElemID, getChangeElement, InstanceElement, ObjectType, Values,
  Element, TypeMap,
} from '@salto-io/adapter-api'
import {
  findElement,
} from '@salto-io/adapter-utils'
import wu from 'wu'
import { command as fetch } from '../../src/commands/fetch'
import adapterConfigs from '../adapter_configs'
import { mockSpinnerCreator, MockWriteStream } from '../../test/mocks'
import { CliOutput, CliExitCode } from '../../src/types'
import { loadWorkspace } from '../../src/workspace/workspace'
import { DeployCommand } from '../../src/commands/deploy'
import { command as preview } from '../../src/commands/preview'
import { command as servicesCommand } from '../../src/commands/services'
import { getCliTelemetry } from '../../src/telemetry'

export type ReplacementPair = [string | RegExp, string]

const services = ['salesforce']

const getSalesforceConfig = (): Promise<InstanceElement> =>
  Promise.resolve(adapterConfigs.salesforce())

const mockCliOutput = (): CliOutput =>
  ({ stdout: new MockWriteStream(), stderr: new MockWriteStream() })

const mockTelemetry = telemetrySender(
  { url: 'http://0.0.0.0', token: '1234', enabled: false },
  { installationID: 'abcd', app: 'test' },
)

export const runSalesforceLogin = async (workspaceDir: string): Promise<void> => {
  await servicesCommand(workspaceDir, 'login', mockCliOutput(), getSalesforceConfig, 'salesforce')
    .execute()
}

export const editBlueprint = async (filename: string, replacements: ReplacementPair[]):
  Promise<void> => {
  let fileAsString = await file.readTextFile(filename)
  replacements.forEach(pair => {
    fileAsString = fileAsString.replace(pair[0], pair[1])
  })
  await file.writeFile(filename, fileAsString)
}

export const runFetch = async (fetchOutputDir: string): Promise<void> => {
  await fetch(
    fetchOutputDir,
    true,
    false,
    mockTelemetry,
    mockCliOutput(),
    mockSpinnerCreator([]),
    false,
    services,
  )
    .execute()
}

export const runDeploy = async (
  lastPlan: Plan | undefined, fetchOutputDir: string, force = false,
): Promise<void> => {
  if (lastPlan) {
    lastPlan.clear()
  }
  const output = mockCliOutput()
  const result = await new DeployCommand(
    fetchOutputDir,
    force,
    getCliTelemetry(mockTelemetry, 'deploy'),
    output,
    mockSpinnerCreator([]),
    services
  ).execute()
  const errs = (output.stderr as MockWriteStream).content
  // This assert is before result assert so will see the error
  expect(errs).toHaveLength(0)
  expect(result).toBe(CliExitCode.Success)
}

export const runPreview = async (fetchOutputDir: string): Promise<CliExitCode> => (
  preview(
    fetchOutputDir, getCliTelemetry(mockTelemetry, 'preview'),
    mockCliOutput(), mockSpinnerCreator([]),
    services,
    true,
  ).execute()
)

export const runEmptyPreview = async (lastPlan: Plan, fetchOutputDir: string): Promise<void> => {
  if (lastPlan) {
    lastPlan.clear()
  }
  await runPreview(fetchOutputDir)
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
