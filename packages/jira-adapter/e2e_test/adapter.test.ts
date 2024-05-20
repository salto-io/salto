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
  DeployResult,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceElement,
  isObjectType,
  ModificationChange,
  ProgressReporter,
  ReadOnlyElementsSource,
  toChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { elements as elementUtils, resolveValues } from '@salto-io/adapter-components'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { buildElementsSourceFromElements, getParents, safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import each from 'jest-each'
import { Credentials } from '../src/auth'
import { credsLease, realAdapter } from './adapter'
import 'jest-extended'
import JiraAdapter from '../src/adapter'
import { createInstances, createModifyInstances } from './instances'
import { findInstance } from './utils'
import { getLookUpName } from '../src/reference_mapping'
import { getDefaultConfig } from '../src/config/config'
import { BEHAVIOR_TYPE } from '../src/constants'

const { awu } = collections.asynciterable
const { replaceInstanceTypeForDeploy } = elementUtils.ducktype
const log = logger(module)

jest.setTimeout(600 * 1000)

const excludedTypes = [
  BEHAVIOR_TYPE,
  'Behavior__config',
  'ObjectTypes',
  'ObjectSchemas',
  'ObjectSchemaStatuses',
  'ObjectSchemaReferenceTypes',
]

const nullProgressReporter: ProgressReporter = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  reportProgress: () => {},
}
each([
  ['Cloud', false],
  ['Data Center', true],
]).describe('Jira %s E2E', (_text, isDataCenter) => {
  let fetchedElements: Element[]
  let credLease: CredsLease<Credentials>
  let adapter: JiraAdapter
  let elementsSource: ReadOnlyElementsSource

  beforeAll(async () => {
    log.resetLogCount()
    elementsSource = buildElementsSourceFromElements([])
    credLease = await credsLease(isDataCenter)
    const adapterAttr = realAdapter({
      credentials: credLease.value,
      isDataCenter,
      elementsSource,
    })
    adapter = adapterAttr.adapter
    const { elements } = await adapter.fetch({
      progressReporter: { reportProgress: () => null },
    })
    fetchedElements = elements
  })

  afterAll(async () => {
    if (credLease.return) {
      await credLease.return()
    }
    log.info('Jira E2E: Log counts = %o', log.getLogCount())
  })

  describe('should fetch types', () => {
    let fetchedTypes: string[]

    beforeAll(() => {
      fetchedTypes = fetchedElements.filter(isObjectType).map(e => e.elemID.typeName)
    })
    it.each(Object.keys(getDefaultConfig({ isDataCenter }).apiDefinitions.types))('%s', expectedType => {
      expect(fetchedTypes).toContain(expectedType)
    })
    const scriptRunnerTypes = getDefaultConfig({ isDataCenter }).scriptRunnerApiDefinitions?.types
    if (scriptRunnerTypes !== undefined) {
      it.each(Object.keys(scriptRunnerTypes).filter(type => !excludedTypes.includes(type)))('%s', expectedType => {
        expect(fetchedTypes).toContain(expectedType)
      })
    }

    const jsmTypes = getDefaultConfig({ isDataCenter }).jsmApiDefinitions?.types
    if (jsmTypes !== undefined) {
      it.each(Object.keys(jsmTypes).filter(type => !excludedTypes.includes(type)))('%s', expectedType => {
        expect(fetchedTypes).toContain(expectedType)
      })
    }
  })
  it('should fetch project with schemes', () => {
    const projectInstance = fetchedElements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === 'Project')
      .filter(project => project.value.name === 'Test Project')[0]
    expect(projectInstance?.value).toContainKeys([
      'workflowScheme',
      'permissionScheme',
      'notificationScheme',
      'issueTypeScreenScheme',
    ])
  })

  describe('deploy', () => {
    let addDeployResults: DeployResult[]
    let modifyDeployResults: DeployResult[]
    let addInstanceGroups: InstanceElement[][]
    let modifyInstanceGroups: ModificationChange<InstanceElement>[][]

    beforeAll(async () => {
      elementsSource = buildElementsSourceFromElements(fetchedElements)
      const adapterAttr = realAdapter({
        credentials: credLease.value,
        isDataCenter,
        elementsSource,
      })
      adapter = adapterAttr.adapter
      addInstanceGroups = createInstances(fetchedElements, isDataCenter)

      addDeployResults = await awu(addInstanceGroups)
        .map(async group => {
          const res = await adapter.deploy({
            changeGroup: {
              groupID: group[0].elemID.getFullName(),
              changes: group.map(instance => toChange({ after: instance })),
            },
            progressReporter: nullProgressReporter,
          })

          res.appliedChanges.forEach(appliedChange => {
            const appliedInstance = getChangeData(appliedChange)
            addInstanceGroups
              .flat()
              .flatMap(getParents)
              .filter(parent => parent.elemID.isEqual(appliedInstance.elemID))
              .forEach(parent => {
                parent.resValue = appliedInstance
              })
          })
          return res
        })
        .toArray()

      modifyInstanceGroups = createModifyInstances(fetchedElements, isDataCenter)

      modifyDeployResults = await awu(modifyInstanceGroups)
        .map(async group => {
          const res = await adapter.deploy({
            changeGroup: {
              groupID: group[0].data.after.elemID.getFullName(),
              changes: group,
            },
            progressReporter: nullProgressReporter,
          })

          res.appliedChanges.forEach(appliedChange => {
            const appliedInstance = getChangeData(appliedChange)
            modifyInstanceGroups
              .flat()
              .flatMap(change => getParents(change.data.after))
              .filter(parent => parent.elemID.isEqual(appliedInstance.elemID))
              .forEach(parent => {
                parent.resValue = appliedInstance
              })
          })
          return res
        })
        .toArray()
    })

    it('should have no errors', () => {
      expect(addDeployResults.flatMap(res => res.errors)).toHaveLength(0)
      expect(modifyDeployResults.flatMap(res => res.errors)).toHaveLength(0)
    })

    it('fetch should return the new changes', async () => {
      const { elements } = await adapter.fetch({
        progressReporter: { reportProgress: () => null },
      })

      const resolvedFetchedElements = await Promise.all(elements.map(e => resolveValues(e, getLookUpName)))
      const { scriptRunnerApiDefinitions } = getDefaultConfig({ isDataCenter })

      const typeFixedAddInstanceGroups = addInstanceGroups.flat().map(instance =>
        scriptRunnerApiDefinitions?.types[instance.elemID.typeName] === undefined
          ? instance
          : replaceInstanceTypeForDeploy({
              instance,
              config: scriptRunnerApiDefinitions,
            }),
      )
      const resolvedAddedElements = await Promise.all(
        typeFixedAddInstanceGroups.map(e => resolveValues(e, getLookUpName)),
      )
      resolvedAddedElements.forEach(instance => {
        expect(findInstance(instance.elemID, resolvedFetchedElements).value).toMatchObject(instance.value)
      })

      const typeFixedModifyInstanceGroups = modifyInstanceGroups.flat().map(change =>
        scriptRunnerApiDefinitions?.types[change.data.after.elemID.typeName] === undefined
          ? change.data.after
          : replaceInstanceTypeForDeploy({
              instance: change.data.after,
              config: scriptRunnerApiDefinitions,
            }),
      )
      const resolvedModifiedElements = await Promise.all(
        typeFixedModifyInstanceGroups.map(e => resolveValues(e, getLookUpName)),
      )
      resolvedModifiedElements.forEach(instance => {
        expect(findInstance(instance.elemID, resolvedFetchedElements).value).toMatchObject(instance.value)
      })
    })

    afterAll(async () => {
      const removalChanges = addDeployResults
        .flatMap(res => res.appliedChanges)
        .filter(isAdditionChange)
        .map(change => toChange({ before: getChangeData(change) }))
      removalChanges.forEach(change => {
        const instance = getChangeData(change)
        removalChanges
          .map(getChangeData)
          .flatMap(getParents)
          .filter(parent => parent.elemID.isEqual(instance.elemID))
          .forEach(parent => {
            parent.resValue = instance
          })
      })

      addDeployResults = await Promise.all(
        removalChanges.map(change => {
          try {
            return adapter.deploy({
              changeGroup: {
                groupID: getChangeData(change).elemID.getFullName(),
                changes: [change],
              },
              progressReporter: nullProgressReporter,
            })
          } catch (e) {
            if (String(e).includes('status code 404')) {
              return {
                errors: [],
                appliedChanges: [],
              }
            }
            throw e
          }
        }),
      )

      const errors = addDeployResults.flatMap(res => res.errors)
      if (errors.length) {
        throw new Error(`Failed to clean e2e changes: ${errors.map(e => safeJsonStringify(e)).join(', ')}`)
      }
    })
  })
})
