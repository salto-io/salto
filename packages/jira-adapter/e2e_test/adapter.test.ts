/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { DeployResult, Element, getChangeData, InstanceElement, isAdditionChange, isInstanceElement, isObjectType, toChange } from '@salto-io/adapter-api'
import { config as configUtils } from '@salto-io/adapter-components'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import _ from 'lodash'
import { getParents, resolveValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { Credentials } from '../src/auth'
import { credsLease, realAdapter } from './adapter'
import { DEFAULT_API_DEFINITIONS, DEFAULT_CONFIG } from '../src/config'
import 'jest-extended'
import JiraAdapter from '../src/adapter'
import { createInstances } from './instances'
import { findInstance } from './utils'
import { getLookUpName } from '../src/reference_mapping'

const { awu } = collections.asynciterable

jest.setTimeout(300 * 1000)

describe('Jira E2E', () => {
  let fetchedElements: Element[]
  let credLease: CredsLease<Credentials>
  let adapter: JiraAdapter

  beforeAll(async () => {
    credLease = await credsLease()
    const config = _.cloneDeep(DEFAULT_CONFIG);
    (config.apiDefinitions.types.Field.transformation as configUtils.TransformationConfig).idFields = ['name']
    const adapterAttr = realAdapter({ credentials: credLease.value }, config)
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
    it.each(Object.keys(DEFAULT_API_DEFINITIONS.types))('%s', expectedType => {
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
      instanceGroups = createInstances(fetchedElements)

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
