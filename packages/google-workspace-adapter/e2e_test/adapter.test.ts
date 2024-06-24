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
} from '@salto-io/adapter-api'
import {
  applyDetailedChanges,
  buildElementsSourceFromElements,
  detailedCompare,
  inspectValue,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { fetch as fetchUtils, definitions as definitionsUtils } from '@salto-io/adapter-components'
import { collections, promises } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import {
  DOMAIN_TYPE_NAME,
  GROUP_MEMBER_TYPE_NAME,
  GROUP_TYPE_NAME,
  ORG_UNIT_TYPE_NAME,
  ROLE_ASSIGNMENT_TYPE_NAME,
  ROLE_TYPE_NAME,
  SCHEMA_TYPE_NAME,
} from '../src/constants'
import { Credentials } from '../src/auth'
import { credsLease, realAdapter, Reals } from './adapter'
import { mockDefaultValues } from './mock_elements'
import { createFetchDefinitions } from '../src/definitions'

const { awu } = collections.asynciterable
const { sleep } = promises.timeout

const log = logger(module)

jest.setTimeout(1000 * 60 * 10)

const TEST_PREFIX = 'Test'

const nameFieldPerType: Record<string, string> = {
  [GROUP_TYPE_NAME]: 'name',
  [ROLE_TYPE_NAME]: 'roleName',
  [SCHEMA_TYPE_NAME]: 'schemaName',
}

const createInstance = ({
  typeName,
  types,
  name,
}: {
  typeName: string
  types: ObjectType[]
  name: string
}): InstanceElement => {
  const instValues = mockDefaultValues[typeName]
  instValues[nameFieldPerType[typeName]] = name

  const type = types.find(t => t.elemID.typeName === typeName)
  if (type === undefined) {
    log.warn(`Could not find type ${typeName}, error while creating instance`)
    throw new Error(`Failed to find type ${typeName}`)
  }
  const fetchDefinitions = createFetchDefinitions()
  const elemIDDef = definitionsUtils.queryWithDefault(fetchDefinitions.instances).query(typeName)?.element
    ?.topLevel?.elemID
  if (elemIDDef === undefined) {
    log.warn(`Could not find type elemID definitions for type ${typeName}, error while creating instance`)
    throw new Error(`Could not find type elemID definitions for type ${typeName}`)
  }
  const elemIDFunc = fetchUtils.element.createElemIDFunc<never>({ elemIDDef, typeID: type.elemID })
  const elemID = elemIDFunc({ entry: instValues, defaultName: 'unnamed_0' })
  return new InstanceElement(elemID, type, instValues, undefined, undefined)
}

const createChangesForDeploy = (types: ObjectType[], testSuffix: string): Change<InstanceElement>[] => {
  const createName = (type: string): string => `Test${type}${testSuffix}`

  const groupInstance = createInstance({
    typeName: GROUP_TYPE_NAME,
    types,
    name: createName(GROUP_TYPE_NAME),
  })

  const roleInstance = createInstance({
    typeName: ROLE_TYPE_NAME,
    types,
    name: createName(ROLE_TYPE_NAME),
  })

  const schemaInstance = createInstance({
    typeName: SCHEMA_TYPE_NAME,
    types,
    name: createName(SCHEMA_TYPE_NAME),
  })

  return [toChange({ after: groupInstance }), toChange({ after: roleInstance }), toChange({ after: schemaInstance })]
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

const checkNameField = (instance: InstanceElement): boolean => {
  const { typeName } = instance.elemID
  const nameField = instance.value[nameFieldPerType[typeName]]
  return typeof nameField === 'string' && nameField.startsWith(TEST_PREFIX)
}

const getChangesForInitialCleanup = (elements: InstanceElement[]): Change<InstanceElement>[] =>
  elements.filter(checkNameField).map(instance => toChange({ before: instance }))

const deployCleanup = async (adapterAttr: Reals, elements: InstanceElement[]): Promise<void> => {
  log.debug('Cleaning up the environment before starting e2e test')
  const cleanupChanges = getChangesForInitialCleanup(elements)
  await deployChanges(adapterAttr, cleanupChanges)
  log.debug('Environment cleanup successful')
}

describe('Google Workspace adapter E2E', () => {
  describe('fetch and deploy', () => {
    let credLease: CredsLease<Credentials>
    let adapterAttr: Reals
    let elements: Element[] = []
    let deployResults: DeployResult[]
    const testSuffix = uuidv4().slice(0, 8)

    const deployAndFetch = async (changes: Change[]): Promise<void> => {
      deployResults = await deployChanges(adapterAttr, changes)
      // Google workspace API takes time to reflect the changes from the deploy.
      // So, we need to wait for some time before fetching in order to get the new elements.
      await sleep(10000)
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

      deployResults = await awu(removalChanges)
        .map(change =>
          adapterAttr.adapter.deploy({
            changeGroup: {
              groupID: getChangeData(change).elemID.getFullName(),
              changes: [change],
            },
            progressReporter: nullProgressReporter,
          }),
        )
        .toArray()

      const errors = deployResults.flatMap(res => res.errors)
      if (errors.length) {
        throw new Error(`Failed to clean e2e changes: ${errors.map(e => safeJsonStringify(e)).join(', ')}`)
      }
      if (credLease.return) {
        await credLease.return()
      }
      log.info('Google Workspace adapter E2E: Log counts = %o', log.getLogCount())
    })
    describe('fetch the regular instances and types', () => {
      const expectedTypes = [
        GROUP_TYPE_NAME,
        ROLE_TYPE_NAME,
        DOMAIN_TYPE_NAME,
        ROLE_ASSIGNMENT_TYPE_NAME,
        GROUP_MEMBER_TYPE_NAME,
        SCHEMA_TYPE_NAME,
        ORG_UNIT_TYPE_NAME,
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

      deployInstances.forEach(deployedInstance => {
        const instance = elements.filter(isInstanceElement).find(e => e.elemID.isEqual(deployedInstance.elemID))
        if (instance === undefined) {
          log.error('Failed to fetch instance after deploy: %s', deployedInstance.elemID.getFullName())
        }
        expect(instance).toBeDefined()
        // Omit hidden fieldId from fields
        const originalValue = _.omit(instance?.value, ['fields.roles.fieldId'])
        const isEqualResult = isEqualValues(originalValue, deployedInstance.value)
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
