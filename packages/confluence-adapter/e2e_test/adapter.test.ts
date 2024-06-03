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

import _ from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import {
  Change,
  DeployResult,
  Element,
  InstanceElement,
  ObjectType,
  ProgressReporter,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isEqualValues,
  isInstanceChange,
  isInstanceElement,
  isObjectType,
  toChange,
  ReferenceExpression,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import {
  applyDetailedChanges,
  buildElementsSourceFromElements,
  detailedCompare,
  inspectValue,
} from '@salto-io/adapter-utils'
import { definitions as definitionsUtils, fetch as fetchUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import {
  SPACE_TYPE_NAME,
  PAGE_TYPE_NAME,
  TEMPLATE_TYPE_NAME,
  LABEL_TYPE_NAME,
  SPACE_SETTINGS_TYPE_NAME,
  GLOBAL_TEMPLATE_TYPE_NAME,
} from '../src/constants'
import { Credentials } from '../src/auth'
import { credsLease, realAdapter, Reals } from './adapter'
import { mockDefaultValues } from './mock_elements'
import { createFetchDefinitions } from '../src/definitions'

const { awu } = collections.asynciterable
const log = logger(module)

jest.setTimeout(1000 * 60 * 10)

const TEST_PREFIX = 'Test'

const uniqueFieldsPerType: Record<string, string[]> = {
  [SPACE_TYPE_NAME]: ['key', 'name'],
  [PAGE_TYPE_NAME]: ['title'],
  [TEMPLATE_TYPE_NAME]: ['name'],
}

const fieldsToOmitOnComparisonPerType: Record<string, string[]> = {
  [SPACE_TYPE_NAME]: ['permissionInternalIdMap', 'homepage', 'permissions'],
  [PAGE_TYPE_NAME]: ['version', 'createdAt', 'parentId', 'spaceId'],
  [TEMPLATE_TYPE_NAME]: [],
}

const createInstance = ({
  typeName,
  types,
  testSuffix,
  parentRef,
  referenceFieldsMap = {},
  fieldsToOverrideWithUniqueValue = uniqueFieldsPerType[typeName],
}: {
  typeName: string
  types: ObjectType[]
  testSuffix: string
  parentRef?: ReferenceExpression
  referenceFieldsMap?: Record<string, ReferenceExpression>
  fieldsToOverrideWithUniqueValue?: string[]
}): InstanceElement => {
  const uniqueValue = `Test${typeName}${testSuffix}`
  const fetchDefinitions = createFetchDefinitions()
  const elemIDDef = definitionsUtils.queryWithDefault(fetchDefinitions.instances).query(typeName)?.element
    ?.topLevel?.elemID
  if (elemIDDef === undefined) {
    log.warn(`Could not find type elemID definitions for type ${typeName}, error while creating instance`)
    throw new Error(`Could not find type elemID definitions for type ${typeName}`)
  }
  const type = types.find(t => t.elemID.typeName === typeName)
  if (type === undefined) {
    log.warn(`Could not find type ${typeName}, error while creating instance`)
    throw new Error(`Failed to find type ${typeName}`)
  }
  const instValues = mockDefaultValues[typeName]
  fieldsToOverrideWithUniqueValue.forEach(fieldName => {
    instValues[fieldName] = uniqueValue
  })
  Object.entries(referenceFieldsMap).forEach(([fieldName, ref]) => {
    instValues[fieldName] = ref
  })
  const elemIDFunc = fetchUtils.element.createElemIDFunc<never>({ elemIDDef, typeID: type.elemID })
  const elemID = elemIDFunc({
    entry: instValues,
    defaultName: 'unnamed_0',
    parent: parentRef !== undefined ? parentRef.value : undefined,
  })
  return new InstanceElement(
    elemID,
    type,
    instValues,
    undefined,
    parentRef ? { [CORE_ANNOTATIONS.PARENT]: [parentRef] } : undefined,
  )
}

const createChangesForDeploy = (types: ObjectType[], testSuffix: string): Change<InstanceElement>[] => {
  const spaceInstance = createInstance({
    typeName: SPACE_TYPE_NAME,
    types,
    testSuffix,
  })

  const spaceRef = new ReferenceExpression(spaceInstance.elemID, spaceInstance)
  const pageInstance = createInstance({
    typeName: PAGE_TYPE_NAME,
    types,
    referenceFieldsMap: { spaceId: spaceRef },
    testSuffix,
  })

  const templateInstance = createInstance({
    typeName: TEMPLATE_TYPE_NAME,
    types,
    parentRef: spaceRef,
    testSuffix,
  })

  return [toChange({ after: spaceInstance }), toChange({ after: pageInstance }), toChange({ after: templateInstance })]
}

const nullProgressReporter: ProgressReporter = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  reportProgress: () => {},
}

const deployChanges = async (adapterAttr: Reals, changes: Change[]): Promise<DeployResult[]> => {
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

const checkUniqueNameField = (instance: InstanceElement): boolean => {
  const { typeName } = instance.elemID
  const uniqueFieldsName = uniqueFieldsPerType[typeName]
  return uniqueFieldsName?.every(field => {
    const value = instance.value[field]
    return typeof value === 'string' && value.startsWith(TEST_PREFIX)
  })
}

const getChangesForInitialCleanup = (elements: InstanceElement[]): Change<InstanceElement>[] =>
  elements.filter(checkUniqueNameField).map(instance => toChange({ before: instance }))

const deployCleanup = async (adapterAttr: Reals, elements: InstanceElement[]): Promise<void> => {
  log.debug('Cleaning up the environment before starting e2e test')
  const cleanupChanges = getChangesForInitialCleanup(elements)
  await deployChanges(adapterAttr, cleanupChanges)
  log.debug('Environment cleanup successful')
}

describe('Confluence adapter E2E', () => {
  describe('fetch and deploy', () => {
    let credLease: CredsLease<Credentials>
    let adapterAttr: Reals
    let elements: Element[] = []
    let deployResults: DeployResult[]
    const testSuffix = uuidv4().slice(0, 8)

    const deployAndFetch = async (changes: Change[]): Promise<void> => {
      deployResults = await deployChanges(adapterAttr, changes)
      const fetchResult = await adapterAttr.adapter.fetch({
        progressReporter: { reportProgress: () => null },
      })
      elements = fetchResult.elements
      adapterAttr = realAdapter({
        credentials: credLease.value,
        elementsSource: buildElementsSourceFromElements(elements),
      })
    }
    beforeAll(async () => {
      log.resetLogCount()
      credLease = await credsLease()
      adapterAttr = realAdapter({ credentials: credLease.value, elementsSource: buildElementsSourceFromElements([]) })
      const fetchBeforeCleanupResult = await adapterAttr.adapter.fetch({
        progressReporter: { reportProgress: () => null },
      })

      const types = fetchBeforeCleanupResult.elements.filter(isObjectType)
      await deployCleanup(adapterAttr, fetchBeforeCleanupResult.elements.filter(isInstanceElement))

      const changesToDeploy = createChangesForDeploy(types, testSuffix)
      await deployAndFetch(changesToDeploy)
    })

    afterAll(async () => {
      const appliedChanges = deployResults
        .flatMap(res => res.appliedChanges)
        .filter(isAdditionChange)
        .filter(isInstanceChange)

      const removalChanges = appliedChanges.map(change => toChange({ before: getChangeData(change) }))

      await deployChanges(adapterAttr, removalChanges)
      if (credLease.return) {
        await credLease.return()
      }
      log.info('Confluence adapter E2E: Log counts = %o', log.getLogCount())
    })
    describe('fetch the regular instances and types', () => {
      const expectedTypes = [
        PAGE_TYPE_NAME,
        SPACE_TYPE_NAME,
        TEMPLATE_TYPE_NAME,
        LABEL_TYPE_NAME,
        SPACE_SETTINGS_TYPE_NAME,
        GLOBAL_TEMPLATE_TYPE_NAME,
      ]
      const typesWithInstances = new Set(expectedTypes)

      let createdTypeNames: string[]
      let createdInstances: InstanceElement[]

      beforeAll(async () => {
        createdTypeNames = elements.filter(isObjectType).map(e => e.elemID.typeName)
        createdInstances = elements.filter(isInstanceElement)
      })

      it.each(expectedTypes)('should fetch %s', async typeName => {
        expect(createdTypeNames).toContain(typeName)
        if (typesWithInstances.has(typeName)) {
          expect(createdInstances.filter(instance => instance.elemID.typeName === typeName).length).toBeGreaterThan(0)
        }
      })
    })
    it('should fetch the newly deployed instances', async () => {
      const deployInstances = deployResults
        .map(res => res.appliedChanges)
        .flat()
        .map(change => getChangeData(change)) as InstanceElement[]
      const fetchInstanceIndex = _.keyBy(elements.filter(isInstanceElement), inst => inst.elemID.getFullName())
      deployInstances.forEach(deployedInstance => {
        const { typeName } = deployedInstance.elemID
        const instance = fetchInstanceIndex[deployedInstance.elemID.getFullName()]
        expect(instance).toBeDefined()
        const originalValue = _.omit(instance?.value, fieldsToOmitOnComparisonPerType[typeName])
        const deployedValue = _.omit(deployedInstance.value, fieldsToOmitOnComparisonPerType[typeName])
        const isEqualResult = isEqualValues(originalValue, deployedValue)
        if (!isEqualResult) {
          log.error(
            'Received unexpected result when deploying instance: %s. Deployed value: %s , Received value after fetch: %s',
            deployedInstance.elemID.getFullName(),
            inspectValue(deployedInstance.value, { depth: 7 }),
            inspectValue(originalValue, { depth: 7 }),
          )
        }
        expect(isEqualResult).toBeTruthy()
      })
    })
  })
})
