/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { DeployResult, Element, getChangeData, InstanceElement, isAdditionChange, isInstanceElement, isObjectType, ReadOnlyElementsSource, toChange } from '@salto-io/adapter-api'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { buildElementsSourceFromElements, getParents, resolveValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import each from 'jest-each'
import { Credentials } from '../src/auth'
import { credsLease, realAdapter } from './adapter'
import 'jest-extended'
import JiraAdapter from '../src/adapter'
import { createInstances } from './instances'
import { findInstance } from './utils'
import { getLookUpName } from '../src/reference_mapping'
import { getDefaultConfig } from '../src/config/config'

const { awu } = collections.asynciterable

jest.setTimeout(600 * 1000)

each([
  ['Cloud', false],
  ['Data Center', true],
]).describe('Jira %s E2E', (_text, isDataCenter) => {
  let fetchedElements: Element[]
  let credLease: CredsLease<Credentials>
  let adapter: JiraAdapter
  let elementsSource: ReadOnlyElementsSource

  beforeAll(async () => {
    elementsSource = buildElementsSourceFromElements([])
    credLease = await credsLease(isDataCenter)
    const adapterAttr = realAdapter(
      {
        credentials: credLease.value,
        isDataCenter,
        elementsSource,
      },
    )
    adapter = adapterAttr.adapter
    const { elements } = await adapter.fetch({
      progressReporter:
        { reportProgress: () => null },
    })
    fetchedElements = elements
  })

  afterAll(async () => {
    if (credLease.return) {
      await credLease.return()
    }
  })

  describe('should fetch types', () => {
    let fetchedTypes: string[]

    beforeAll(() => {
      fetchedTypes = fetchedElements
        .filter(isObjectType)
        .map(e => e.elemID.typeName)
    })
    it.each(Object.keys(getDefaultConfig({ isDataCenter }).apiDefinitions.types))('%s', expectedType => {
      expect(fetchedTypes).toContain(expectedType)
    })
  })
  it('should fetch project with schemes', () => {
    const projectInstance = fetchedElements
      .filter(isInstanceElement)
      .find(e => e.elemID.typeName === 'Project')
    expect(projectInstance?.value).toContainKeys([
      'workflowScheme',
      'permissionScheme',
      'notificationScheme',
      'issueTypeScreenScheme',
    ])
  })

  describe('deploy', () => {
    let deployResults: DeployResult[]
    let instanceGroups: InstanceElement[][]

    beforeAll(async () => {
      elementsSource = buildElementsSourceFromElements(fetchedElements)
      const adapterAttr = realAdapter(
        {
          credentials: credLease.value,
          isDataCenter,
          elementsSource,
        },
      )
      adapter = adapterAttr.adapter
      instanceGroups = createInstances(fetchedElements, isDataCenter)

      deployResults = await awu(instanceGroups).map(async group => {
        const res = await adapter.deploy({
          changeGroup: {
            groupID: group[0].elemID.getFullName(),
            changes: group.map(instance => toChange({ after: instance })),
          },
        })

        res.appliedChanges.forEach(appliedChange => {
          const appliedInstance = getChangeData(appliedChange)
          instanceGroups
            .flat()
            .flatMap(getParents)
            .filter(parent => parent.elemID.isEqual(appliedInstance.elemID))
            .forEach(parent => {
              parent.resValue = appliedInstance
            })
        })
        return res
      }).toArray()
    })

    it('should have no errors', () => {
      expect(deployResults.flatMap(res => res.errors)).toHaveLength(0)
    })

    it('fetch should return the new changes', async () => {
      const { elements } = await adapter.fetch({
        progressReporter:
          { reportProgress: () => null },
      })

      const resolvedFetchedElements = await Promise.all(
        elements.map(e => resolveValues(e, getLookUpName))
      )
      const resolvedDeployedElements = await Promise.all(
        instanceGroups.flat().map(e => resolveValues(e, getLookUpName))
      )
      resolvedDeployedElements.forEach(instance => {
        expect(findInstance(instance.elemID, resolvedFetchedElements).value)
          .toMatchObject(instance.value)
      })
    })

    afterAll(async () => {
      const removalChanges = deployResults
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

      deployResults = await Promise.all(removalChanges.map(change =>
        adapter.deploy({
          changeGroup: {
            groupID: getChangeData(change).elemID.getFullName(),
            changes: [change],
          },
        })))

      const errors = deployResults.flatMap(res => res.errors)
      if (errors.length) {
        throw new Error(`Failed to clean e2e changes: ${errors.join(', ')}`)
      }
    })
  })
})
