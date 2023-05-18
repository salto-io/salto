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
import _ from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import { Change, ChangeId, CORE_ANNOTATIONS, DeployResult, Element, ElemID, FieldDefinition, getChangeData,
  InstanceElement, isAdditionOrModificationChange, isInstanceElement, isObjectType, ObjectType, ReferenceExpression,
  toChange, Values } from '@salto-io/adapter-api'
import {
  applyDetailedChanges,
  buildElementsSourceFromElements,
  detailedCompare,
  naclCase,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { config as configUtils } from '@salto-io/adapter-components'
import { collections, values } from '@salto-io/lowerdash'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { expressions } from '@salto-io/workspace'
import {
  API_DEFINITIONS_CONFIG,
  DEFAULT_CONFIG,
} from '../src/config'
import { GROUP_TYPE_NAME, OKTA } from '../src/constants'
import { Credentials } from '../src/auth'
import { credsLease, realAdapter, Reals } from './adapter'
import { mockDefaultValues } from './mock_elements'

const { awu } = collections.asynciterable
const log = logger(module)

// Set long timeout as we communicate with Okta APIs
// TODO check this timeout
jest.setTimeout(1000 * 60 * 15)

// TODO share code with Zendesk ?
const createInstanceElement = ({
  type,
  valuesOverride,
  fields,
  parent,
  name,
} :{
  type: string
  valuesOverride: Values
  fields?: Record <string, FieldDefinition>
  parent?: InstanceElement
  name?: string
}): InstanceElement => {
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
    name ?? naclCase(nameParts.map(String).join('_')),
    new ObjectType({ elemID: new ElemID(OKTA, type), fields }),
    instValues,
    undefined,
    parent
      ? { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] }
      : undefined
  )
}

const deployChanges = async (
  adapterAttr: Reals, changes: Record<ChangeId, Change<InstanceElement>[]>
): Promise<DeployResult[]> => {
  let planElementById: Record<string, InstanceElement>
  const deployResults = await awu(Object.entries(changes))
    .map(async ([id, group]) => {
      planElementById = _.keyBy(group.map(getChangeData), data => data.elemID.getFullName())
      const deployResult = await adapterAttr.adapter.deploy({
        changeGroup: { groupID: id, changes: group },
      })
      expect(deployResult.errors).toHaveLength(0)
      expect(deployResult.appliedChanges).not.toHaveLength(0)
      deployResult.appliedChanges // need to update reference expressions
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(e => [
          GROUP_TYPE_NAME,
        ].includes(e.elemID.typeName))
        .forEach(updatedElement => {
          const planElement = planElementById[updatedElement.elemID.getFullName()]
          if (planElement !== undefined) {
            applyDetailedChanges(planElement, detailedCompare(planElement, updatedElement))
          }
        })
      return deployResult
    })
    .toArray()
  return deployResults
}

const cleanup = async (adapterAttr: Reals): Promise<void> => {
  const fetchResult = await adapterAttr.adapter.fetch({
    progressReporter:
      { reportProgress: () => null },
  })
  expect(fetchResult.errors).toHaveLength(0)
  // const { elements } = fetchResult
  // expect(elements).toHaveLength(1)
  // // TODO add more checks here?
}

const usedConfig = DEFAULT_CONFIG

describe('Okta adapter E2E', () => {
  describe('fetch and deploy', () => {
    let credLease: CredsLease<Credentials>
    let adapterAttr: Reals
    const testSuffix = uuidv4().slice(0, 8)
    let elements: Element[] = []
    // TODO e2e for privateAPIInstances
    // let privateAPIInstances : InstanceElement[]
    const createName = (type: string): string => `Test${type}${testSuffix}`

    let groupIdToInstances: Record<string, InstanceElement[]>
    /**
     * deploy instances to add and fetch afterwards.
     * if beforall is true groupIdToInstances will update to the new elements deployed.
     * this function allows the deploy and fetch multiple times in the e2e, if needed.
     */
    const deployAndFetch = async (instancesToAdd: InstanceElement[], beforeAll: boolean): Promise<void> => {
      // Okta uses default change group for now (by elem ID)
      const changeGroups = new Map<string, Change>(
        instancesToAdd.map(inst => [inst.elemID.getFullName(), toChange({ after: inst })])
      )
      const groupIdToInstancesTemp = _.groupBy(
        instancesToAdd,
        inst => changeGroups.get(inst.elemID.getFullName())
      )
      groupIdToInstances = beforeAll ? groupIdToInstancesTemp : groupIdToInstances
      const firstGroupChanges = _.mapValues(
        groupIdToInstancesTemp,
        instances => instances.map(inst => toChange({ after: inst }))
      )
      await deployChanges(adapterAttr, firstGroupChanges)
      const fetchResult = await adapterAttr.adapter.fetch({
        progressReporter:
          { reportProgress: () => null },
      })
      elements = fetchResult.elements
      log.debug(`In deploy and fetch, fetch ${elements.length} elements, instance: ${elements.filter(isInstanceElement).map(i => i.elemID.getFullName())}`)
      expect(fetchResult.errors).toHaveLength(0)
      adapterAttr = realAdapter(
        { credentials: credLease.value,
          elementsSource: buildElementsSourceFromElements(elements) },
        usedConfig
      )
    }

    beforeAll(async () => {
      credLease = await credsLease()
      adapterAttr = realAdapter(
        { credentials: credLease.value, elementsSource: buildElementsSourceFromElements([]) },
        usedConfig
      )
      const firstFetchResult = await adapterAttr.adapter.fetch({
        progressReporter: { reportProgress: () => null },
      })

      // ******************* create elements for deploy *******************
      // TODO create instance with references and everything, adjust createInstanceElement and use it
      const groupInstance = createInstanceElement({
        type: GROUP_TYPE_NAME,
        valuesOverride: {
          objectClass: ['okta:user_group'],
          type: 'OKTA_GROUP',
          profile: { name: createName('testGroup'), description: 'e2e' },
        },
      })

      adapterAttr = realAdapter(
        { credentials: credLease.value,
          elementsSource: buildElementsSourceFromElements(
            // TODO maybe change this?
            firstFetchResult.elements
          ) },
        DEFAULT_CONFIG,
      )
      await cleanup(adapterAttr)
      const instancesToAdd = [
        groupInstance,
      ]
      await deployAndFetch(instancesToAdd, true)
    })

    afterAll(async () => {
      elements = await expressions.resolve(elements, buildElementsSourceFromElements(elements))
      const firstGroupChanges = _.mapValues(
        groupIdToInstances,
        instancesToRemove => instancesToRemove.map(inst => {
          const instanceToRemove = elements.find(e => e.elemID.isEqual(inst.elemID))
          return instanceToRemove
            ? toChange({ before: instanceToRemove as InstanceElement })
            : undefined
        }).filter(values.isDefined)
      )

      await deployChanges(adapterAttr, firstGroupChanges)
      if (credLease.return) {
        await credLease.return()
      }
    })
    it('should fetch the regular instances and types', async () => {
      const typesToFetch = [
        'AccessPolicy',
        'AccessPolicyRule',
        'Application',
        'Authenticator',
        // TODO add AuthorizationServer?
        'BehaviorRule',
        'DeviceAssurance',
        'EventHook',
        'Feature',
        'Group',
        'GroupRule',
        'GroupSchema',
        'IdentityProvider',
        'IdentityProviderPolicy',
        'IdentityProviderPolicyRule',
        'InlineHook',
        'MultifactorEnrollmentPolicy',
        'MultifactorEnrollmentPolicyRule',
        'NetworkZone',
        'OktaSignOnPolicy',
        'OktaSignOnPolicyRule',
        'PasswordPolicy',
        'PasswordPolicyRule',
        'ProfileEnrollmentPolicy',
        'ProfileEnrollmentPolicyRule',
        'Role',
        'RoleAssignment',
        // TODO add settings types
        'SmsTemplate',
        'TrustedOrigin',
        'UserSchema',
        'UserType',
      ]
      const typeNames = elements.filter(isObjectType).map(e => e.elemID.typeName)
      const instances = elements.filter(isInstanceElement)
      typesToFetch.forEach(typeName => {
        expect(typeNames).toContain(typeName)
        const instance = instances.find(e => e.elemID.typeName === typeName)
        expect(instance).toBeDefined()
      })
    })
    it('should fetch the newly deployed instances', async () => {
      const instances = Object.values(groupIdToInstances).flat()
      instances
        .forEach(instanceToAdd => {
          const instance = elements.find(e => e.elemID.isEqual(instanceToAdd.elemID))
          expect(instance).toBeDefined()
          expect((instance as InstanceElement).value).toMatchObject(instanceToAdd.value)
        })
    })
  })
})
