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
import {
  AdapterOperations,
  Change,
  CORE_ANNOTATIONS,
  DeployResult,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  ObjectType,
  ProgressReporter,
  ReferenceExpression,
  toChange,
  Values,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@salto-io/logging'
import { applyDetailedChanges, detailedCompare } from '@salto-io/adapter-utils'
import * as element from './fetch/element'
import { APIDefinitionsOptions, queryWithDefault } from './definitions'
import { FetchApiDefinitions } from './definitions/system/fetch'

const { awu } = collections.asynciterable
const log = logger(module)

export const TEST_PREFIX = 'Test'

export type Reals = {
  adapter: AdapterOperations
}
const nullProgressReporter: ProgressReporter = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  reportProgress: () => {},
}

export const getTestSuffix = (): string => uuidv4().slice(0, 8)

export const deployChangesForE2e = async (adapterAttr: Reals, changes: Change[]): Promise<DeployResult[]> => {
  const planElementById = _.keyBy(changes.map(getChangeData), inst => inst.elemID.getFullName())
  return awu(changes)
    .map(async change => {
      const deployResult = await adapterAttr.adapter.deploy({
        changeGroup: { groupID: getChangeData(change).elemID.getFullName(), changes: [change] },
        progressReporter: nullProgressReporter,
      })
      expect(deployResult.errors).toHaveLength(0)
      expect(deployResult.appliedChanges).not.toHaveLength(0)
      deployResult.appliedChanges
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .forEach(updatedElement => {
          const planElement = planElementById[updatedElement.elemID.getFullName()]
          if (planElement !== undefined) {
            applyDetailedChanges(planElement, detailedCompare(planElement, updatedElement))
          }
        })
      return deployResult
    })
    .toArray()
}

export const createInstance = <T extends APIDefinitionsOptions>({
  typeName,
  types,
  fetchDefinitions,
  values,
  parent,
}: {
  typeName: string
  types: ObjectType[]
  fetchDefinitions: FetchApiDefinitions<T>
  values: Values
  parent?: InstanceElement
}): InstanceElement => {
  // const uniqueValue = `${TEST_PREFIX}${typeName}${testSuffix}`
  const elemIDDef = queryWithDefault(fetchDefinitions.instances).query(typeName)?.element?.topLevel?.elemID
  if (elemIDDef === undefined) {
    log.warn(`Could not find type elemID definitions for type ${typeName}, error while creating instance`)
    throw new Error(`Could not find type elemID definitions for type ${typeName}`)
  }
  const type = types.find(t => t.elemID.typeName === typeName)
  if (type === undefined) {
    log.warn(`Could not find type ${typeName}, error while creating instance`)
    throw new Error(`Failed to find type ${typeName}`)
  }

  const elemIDFunc = element.createElemIDFunc({
    elemIDDef,
    typeID: type.elemID,
  })
  const elemID = elemIDFunc({
    entry: values,
    defaultName: 'unnamed_0',
    parent,
  })
  return new InstanceElement(
    elemID,
    type,
    values,
    undefined,
    parent ? { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] } : undefined,
  )
}

export const deployCleanup = async (
  adapterAttr: Reals,
  elements: InstanceElement[],
  uniqueFieldsPerType: Record<string, string[]>,
): Promise<void> => {
  const checkUniqueNameField = (instance: InstanceElement): boolean => {
    const { typeName } = instance.elemID
    const uniqueFieldsName = uniqueFieldsPerType[typeName]
    return uniqueFieldsName?.every(field => {
      const value = instance.value[field]
      return typeof value === 'string' && value.startsWith(TEST_PREFIX)
    })
  }

  const getChangesForInitialCleanup = (instances: InstanceElement[]): Change<InstanceElement>[] =>
    instances.filter(checkUniqueNameField).map(instance => toChange({ before: instance }))

  log.info('Cleaning up the environment before starting e2e test')
  const cleanupChanges = getChangesForInitialCleanup(elements)
  await deployChangesForE2e(adapterAttr, cleanupChanges)
  log.info('Environment cleanup successful')
}
