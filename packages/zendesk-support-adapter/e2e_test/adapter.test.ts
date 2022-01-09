/*
*                      Copyright 2021 Salto Labs Ltd.
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
import uuidv4 from 'uuid/v4'
import { Change, ChangeId, Element, ElemID, InstanceElement, ObjectType, toChange, Values } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { config as configUtils } from '@salto-io/adapter-components'
import { values } from '@salto-io/lowerdash'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { DEFAULT_CONFIG, API_DEFINITIONS_CONFIG } from '../src/config'
import { ZENDESK_SUPPORT } from '../src/constants'
import { Credentials } from '../src/auth'
import { credsLease, realAdapter, Reals } from './adapter'
// import { realAdapter, Reals } from './adapter'
import { mockDefaultValues } from './mock_elements'

// Set long timeout as we communicate with Zendesk APIs
jest.setTimeout(1000000)

const createInstanceElement = (type: string, valuesOverride: Values):
InstanceElement => {
  const instValues = {
    ...mockDefaultValues[type],
    ...valuesOverride,
  }
  const transformationConfig = configUtils.getConfigWithDefault(
    DEFAULT_CONFIG[API_DEFINITIONS_CONFIG].types[type].transformation ?? {},
    DEFAULT_CONFIG[API_DEFINITIONS_CONFIG].typeDefaults.transformation,
  )

  const nameParts = transformationConfig.idFields.map(field => _.get(instValues, field))
  return new InstanceElement(
    naclCase(nameParts.map(String).join('_')),
    new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, type) }),
    instValues
  )
}

const deployChanges = async (
  adapterAttr: Reals, changes: Record<ChangeId, Change<InstanceElement>[]>
): Promise<void> => {
  if (Object.keys(changes).length === 0) {
    return
  }
  for (const [id, group] of Object.entries(changes)) {
    // eslint-disable-next-line no-await-in-loop
    const deployResult = await adapterAttr.adapter.deploy({
      changeGroup: { groupID: id, changes: group },
    })
    expect(deployResult.errors).toHaveLength(0)
    expect(deployResult.appliedChanges).not.toHaveLength(0)
  }
}

describe('Zendesk support adapter E2E', () => {
  describe('fetch', () => {
    let credLease: CredsLease<Credentials>
    let adapterAttr: Reals
    const testSuffix = uuidv4().slice(0, 8)
    let elements: Element[] = []
    const createName = (type: string): string => `Test${type}${testSuffix}`

    const automationInstance = createInstanceElement(
      'automation',
      {
        title: createName('automation'),
        conditions: {
          all: [
            {
              field: 'status',
              operator: 'is',
              value: 'solved',
            },
            {
              field: 'SOLVED',
              operator: 'greater_than',
              // Two automations can't have the same conditions
              value: Math.floor(Math.random() * 100000).toString(),
            },
          ],
        },
      },
    )
    const groupIdToInstances = _.groupBy([automationInstance], i => i.elemID.typeName)

    beforeAll(async () => {
      credLease = await credsLease()
      adapterAttr = realAdapter({ credentials: credLease.value })
      const changes = _.mapValues(
        groupIdToInstances,
        instancesToAdd => instancesToAdd.map(inst => toChange({ after: inst }))
      )
      await deployChanges(adapterAttr, changes)
      elements = (await adapterAttr.adapter.fetch({
        progressReporter:
          { reportProgress: () => null },
      })).elements
    })

    afterAll(async () => {
      const changes = _.mapValues(
        groupIdToInstances,
        instancesToRemove => instancesToRemove.map(inst => {
          const instanceToRemove = elements.find(e => e.elemID.isEqual(inst.elemID))
          return instanceToRemove
            ? toChange({ before: instanceToRemove as InstanceElement })
            : undefined
        }).filter(values.isDefined)
      )
      await deployChanges(adapterAttr, changes)
      if (credLease.return) {
        await credLease.return()
      }
    })

    it('should fetch the newly deployed instances', async () => {
      const instances = Object.values(groupIdToInstances).flat()
      instances.forEach(instanceToAdd => {
        const instance = elements.find(e => e.elemID.isEqual(instanceToAdd.elemID))
        expect(instance).toBeDefined()
        expect((instance as InstanceElement).value).toMatchObject(instanceToAdd.value)
      })
    })
  })
})
