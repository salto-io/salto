/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  CORE_ANNOTATIONS,
  DeployResult,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isObjectType,
  ModificationChange,
  ProgressReporter,
  ReadOnlyElementsSource,
  SaltoElementError,
  SaltoError,
  toChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { elements as elementUtils, resolveValues } from '@salto-io/adapter-components'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import {
  applyDetailedChanges,
  buildElementsSourceFromElements,
  detailedCompare,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import each from 'jest-each'
import { Credentials } from '../src/auth'
import { credsLease, realAdapter } from './adapter'
import '@salto-io/jest-extended'
import JiraAdapter from '../src/adapter'
import { createInstances, createModifyInstances } from './instances'
import { findInstance } from './utils'
import { getLookUpName } from '../src/reference_mapping'
import { getDefaultConfig } from '../src/config/config'
import { BEHAVIOR_TYPE } from '../src/constants'
import {
  FIELD_CONTEXT_OPTION_TYPE_NAME,
  FIELD_CONTEXT_TYPE_NAME,
  FIELD_TYPE_NAME,
} from '../src/filters/fields/constants'

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

  // eslint-disable-next-line jest/no-disabled-tests
  describe.skip('deploy', () => {
    let addDeployResults: DeployResult[]
    let modifyDeployResults: DeployResult[]
    let addInstanceGroups: InstanceElement[][]
    let modifyInstanceGroups: ModificationChange<InstanceElement>[][]
    let elements: Element[]

    beforeAll(async () => {
      // this is normally done by the core
      const updateDeployedInstances = (
        changes: readonly Change[],
        beforeInstanceMap: Record<string, InstanceElement>,
      ): void => {
        changes.map(getChangeData).forEach(updatedInstance => {
          const preDeployInstance = beforeInstanceMap[updatedInstance.elemID.getFullName()]
          if (preDeployInstance !== undefined) {
            applyDetailedChanges(preDeployInstance, detailedCompare(preDeployInstance, updatedInstance))
          }
        })
      }

      elementsSource = buildElementsSourceFromElements(fetchedElements)
      const adapterAttr = realAdapter({
        credentials: credLease.value,
        isDataCenter,
        elementsSource,
      })
      adapter = adapterAttr.adapter
      addInstanceGroups = createInstances(fetchedElements, isDataCenter)
      const fullNameToAddedInstance = Object.fromEntries(
        addInstanceGroups.flat().map(instance => [instance.elemID.getFullName(), instance]),
      )

      addDeployResults = await awu(addInstanceGroups)
        .map(async group => {
          const res = await adapter.deploy({
            changeGroup: {
              groupID: group[0].elemID.getFullName(),
              changes: group.map(instance => toChange({ after: instance })),
            },
            progressReporter: nullProgressReporter,
          })
          updateDeployedInstances(res.appliedChanges, fullNameToAddedInstance)
          return res
        })
        .toArray()

      modifyInstanceGroups = createModifyInstances(fetchedElements, isDataCenter)
      const fullNameToModifiedInstance = Object.fromEntries(
        modifyInstanceGroups
          .flat()
          .map(getChangeData)
          .map(instance => [instance.elemID.getFullName(), instance]),
      )
      modifyDeployResults = await awu(modifyInstanceGroups)
        .map(async group => {
          const res = await adapter.deploy({
            changeGroup: {
              groupID: group[0].data.after.elemID.getFullName(),
              changes: group,
            },
            progressReporter: nullProgressReporter,
          })

          updateDeployedInstances(res.appliedChanges, fullNameToModifiedInstance)
          return res
        })
        .toArray()
    })

    it('should have no errors', () => {
      expect(addDeployResults.flatMap(res => res.errors)).toHaveLength(0)
      expect(modifyDeployResults.flatMap(res => res.errors)).toHaveLength(0)
    })

    it('fetch should return the new changes', async () => {
      ;({ elements } = await adapter.fetch({
        progressReporter: { reportProgress: () => null },
      }))

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
      const removalChangeGroups = addDeployResults
        .map(res => res.appliedChanges)
        .map(changeGroup =>
          changeGroup
            .filter(isAdditionChange)
            .map(change => toChange({ before: getChangeData(change) }))
            .filter(isInstanceChange),
        )

      const deployChanges = async (
        changeGroups: Change<InstanceElement>[][],
        catchCondition: (e: unknown) => boolean,
      ): Promise<(SaltoError | SaltoElementError)[]> => {
        const deployResults = await Promise.all(
          changeGroups.map(changeGroup => {
            try {
              return adapter.deploy({
                changeGroup: {
                  groupID: getChangeData(changeGroup[0]).elemID.getFullName(),
                  changes: changeGroup,
                },
                progressReporter: nullProgressReporter,
              })
            } catch (e) {
              if (catchCondition(e)) {
                return {
                  errors: [],
                  appliedChanges: [],
                }
              }
              throw e
            }
          }),
        )

        return deployResults.flatMap(res => res.errors)
      }

      const errors = await deployChanges(removalChangeGroups, (e: unknown) => String(e).includes('status code 404'))
      if (errors.length) {
        throw new Error(`Failed to clean e2e changes: ${errors.map(e => safeJsonStringify(e)).join(', ')}`)
      }
      const removalInstancesNames = removalChangeGroups.flat().map(change => getChangeData(change).elemID.getFullName())
      const allOssCreatedElements = elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.name.includes('createdByOssE2e'))
        .filter(instance => !removalInstancesNames.includes(instance.elemID.getFullName()))
        .filter(instance => instance.elemID.typeName !== FIELD_TYPE_NAME || instance.value.isLocked === false) // do not delete locked fields
        .filter(
          instance =>
            instance.elemID.typeName !== FIELD_CONTEXT_TYPE_NAME ||
            instance.annotations[CORE_ANNOTATIONS.PARENT]?.[0].value.isLocked === false,
        ) // do not delete contexts of locked fields
        .filter(instance => instance.elemID.typeName !== FIELD_CONTEXT_OPTION_TYPE_NAME) // do not delete options, they will be deleted with their contexts
        .map(instance => toChange({ before: instance }))

      if (!isDataCenter) {
        const allRemovalErrors = await deployChanges([allOssCreatedElements], () => true) // do not fail on errors
        if (allRemovalErrors.length) {
          throw new Error(
            `Failed to clean older e2e changes: ${allRemovalErrors.map(e => safeJsonStringify(e)).join(', ')}`,
          )
        }
      }
    })
  })
})
