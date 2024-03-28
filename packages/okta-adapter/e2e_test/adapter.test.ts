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
  CORE_ANNOTATIONS,
  DeployResult,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isEqualValues,
  isInstanceChange,
  isInstanceElement,
  isObjectType,
  ObjectType,
  ProgressReporter,
  ReferenceExpression,
  TemplateExpression,
  toChange,
  Values,
} from '@salto-io/adapter-api'
import {
  applyDetailedChanges,
  buildElementsSourceFromElements,
  detailedCompare,
  getParents,
  naclCase,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { config as configUtils, elements as elementsUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { API_DEFINITIONS_CONFIG, DEFAULT_CONFIG } from '../src/config'
import {
  ACCESS_POLICY_RULE_TYPE_NAME,
  ACCESS_POLICY_TYPE_NAME,
  APP_GROUP_ASSIGNMENT_TYPE_NAME,
  APPLICATION_TYPE_NAME,
  AUTHENTICATOR_TYPE_NAME,
  GROUP_RULE_TYPE_NAME,
  GROUP_TYPE_NAME,
  INACTIVE_STATUS,
  NETWORK_ZONE_TYPE_NAME,
  ORG_SETTING_TYPE_NAME,
  PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
  PROFILE_ENROLLMENT_RULE_TYPE_NAME,
  ROLE_TYPE_NAME,
  USER_SCHEMA_TYPE_NAME,
  USERTYPE_TYPE_NAME,
} from '../src/constants'
import { Credentials } from '../src/auth'
import { credsLease, realAdapter, Reals } from './adapter'
import { mockDefaultValues } from './mock_elements'

const { awu } = collections.asynciterable
const { getInstanceName } = elementsUtils
const log = logger(module)

// Set long timeout as we communicate with Okta APIs
jest.setTimeout(1000 * 60 * 10)

const createInstance = ({
  typeName,
  valuesOverride,
  types,
  parent,
  name,
}: {
  typeName: string
  valuesOverride: Values
  types: ObjectType[]
  parent?: InstanceElement
  name?: string
}): InstanceElement => {
  const instValues = {
    ...mockDefaultValues[typeName],
    ...valuesOverride,
  }
  const type = types.find(t => t.elemID.typeName === typeName)
  if (type === undefined) {
    log.warn(`Could not find type ${typeName}, error while creating instance`)
    throw new Error(`Failed to find type ${typeName}`)
  }
  const { idFields } = configUtils.getConfigWithDefault(
    DEFAULT_CONFIG[API_DEFINITIONS_CONFIG].types[typeName].transformation ?? {},
    DEFAULT_CONFIG[API_DEFINITIONS_CONFIG].typeDefaults.transformation,
  )
  const instName = name ?? getInstanceName(instValues, idFields, typeName)
  const naclName = naclCase(parent ? `${parent.elemID.name}__${instName}` : String(instName))
  return new InstanceElement(
    naclName,
    type,
    instValues,
    undefined,
    parent ? { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] } : undefined,
  )
}

const createInstancesForDeploy = (types: ObjectType[], testSuffix: string): InstanceElement[] => {
  const createName = (type: string): string => `Test${type}${testSuffix}`

  const groupInstance = createInstance({
    typeName: GROUP_TYPE_NAME,
    types,
    valuesOverride: {
      profile: { name: createName('test1'), description: 'e2e' },
    },
  })
  const anotherGroupInstance = createInstance({
    typeName: GROUP_TYPE_NAME,
    types,
    valuesOverride: {
      profile: { name: createName('test2'), description: 'e2e' },
    },
  })
  const ruleInstance = createInstance({
    typeName: GROUP_RULE_TYPE_NAME,
    types,
    valuesOverride: {
      name: createName('testRule'),
      conditions: {
        expression: {
          value: new TemplateExpression({
            parts: [
              'isMemberOfAnyGroup(',
              new ReferenceExpression(anotherGroupInstance.elemID, anotherGroupInstance),
              ')',
            ],
          }),
          type: 'urn:okta:expression:1.0',
        },
      },
      actions: {
        assignUserToGroups: { groupIds: [new ReferenceExpression(groupInstance.elemID, groupInstance)] },
      },
    },
  })
  const zoneInstance = createInstance({
    typeName: NETWORK_ZONE_TYPE_NAME,
    types,
    valuesOverride: { name: createName('zone') },
  })
  const accessPolicy = createInstance({
    typeName: ACCESS_POLICY_TYPE_NAME,
    types,
    valuesOverride: { name: createName('policy') },
  })
  const accessPolicyRule = createInstance({
    typeName: ACCESS_POLICY_RULE_TYPE_NAME,
    types,
    valuesOverride: {
      name: createName('policyRule'),
      conditions: {
        network: {
          connection: 'ZONE',
          include: [new ReferenceExpression(zoneInstance.elemID, zoneInstance)],
        },
        riskScore: { level: 'ANY' },
      },
    },
    parent: accessPolicy,
  })
  const profileEnrollment = createInstance({
    typeName: PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
    types,
    valuesOverride: { name: createName('profilePolicy') },
  })
  const userSchema = createInstance({
    typeName: USER_SCHEMA_TYPE_NAME,
    types,
    name: 'user',
    valuesOverride: {},
  })
  const profileEnrollmentRule = createInstance({
    typeName: PROFILE_ENROLLMENT_RULE_TYPE_NAME,
    types,
    valuesOverride: {
      actions: {
        profileEnrollment: {
          access: 'ALLOW',
          profileAttributes: [
            {
              name: new ReferenceExpression(
                userSchema.elemID.createNestedID('definitions', 'base', 'properties', 'email'),
                userSchema.value.definitions?.base?.properties?.email,
              ),
              label: 'Email',
              required: true,
            },
            {
              name: new ReferenceExpression(
                userSchema.elemID.createNestedID('definitions', 'base', 'properties', 'lastName'),
                userSchema.value.definitions?.base?.properties?.lastName,
              ),
              label: 'Last name',
              required: true,
            },
            {
              name: new ReferenceExpression(
                userSchema.elemID.createNestedID('definitions', 'base', 'properties', 'firstName'),
                userSchema.value.definitions?.base?.properties?.firstName,
              ),
              label: 'First name',
              required: true,
            },
          ],
          targetGroupIds: [new ReferenceExpression(anotherGroupInstance.elemID, anotherGroupInstance)],
          unknownUserAction: 'DENY',
          activationRequirements: {
            emailVerification: true,
          },
        },
      },
    },
    parent: profileEnrollment,
  })
  const app = createInstance({
    typeName: APPLICATION_TYPE_NAME,
    types,
    valuesOverride: {
      label: createName('SAMLApp'),
      accessPolicy: new ReferenceExpression(accessPolicy.elemID, accessPolicy),
      profileEnrollment: new ReferenceExpression(profileEnrollment.elemID, profileEnrollment),
    },
  })
  const appGroupAssignment = createInstance({
    typeName: APP_GROUP_ASSIGNMENT_TYPE_NAME,
    types,
    valuesOverride: {
      id: new ReferenceExpression(groupInstance.elemID, groupInstance),
    },
    parent: app,
    name: groupInstance.elemID.name,
  })
  return [
    groupInstance,
    anotherGroupInstance,
    ruleInstance,
    zoneInstance,
    accessPolicy,
    accessPolicyRule,
    profileEnrollment,
    profileEnrollmentRule,
    app,
    appGroupAssignment,
  ]
}

const nullProgressReporter: ProgressReporter = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  reportProgress: () => {},
}

const deployChanges = async (adapterAttr: Reals, instancesToAdd: InstanceElement[]): Promise<DeployResult[]> => {
  const planElementById = _.keyBy(instancesToAdd, inst => inst.elemID.getFullName())
  const deployResults = await awu(instancesToAdd)
    .map(async instance => {
      const deployResult = await adapterAttr.adapter.deploy({
        changeGroup: { groupID: instance.elemID.getFullName(), changes: [toChange({ after: instance })] },
        progressReporter: nullProgressReporter,
      })
      expect(deployResult.errors).toHaveLength(0)
      expect(deployResult.appliedChanges).not.toHaveLength(0)
      deployResult.appliedChanges // need to update reference expressions
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
  return deployResults
}

const removeApp = async (adapterAttr: Reals, changes: Change<InstanceElement>[]): Promise<void> => {
  const activeApp = changes
    .map(change => getChangeData(change))
    .find(inst => inst.elemID.typeName === APPLICATION_TYPE_NAME)
  if (activeApp === undefined) {
    throw new Error('Could not find deployed application, failed to clean e2e changes')
  }
  const inactiveApp = activeApp.clone()
  inactiveApp.value.status = INACTIVE_STATUS
  // Application must be deactivated before removal
  const appDeactivationChange = toChange({ before: activeApp, after: inactiveApp })
  const appDeployResult = await adapterAttr.adapter.deploy({
    changeGroup: {
      groupID: getChangeData(appDeactivationChange).elemID.getFullName(),
      changes: [appDeactivationChange],
    },
    progressReporter: nullProgressReporter,
  })

  const appRemovalChange = appDeployResult.appliedChanges.find(
    change => getChangeData(change).elemID.typeName === APPLICATION_TYPE_NAME,
  )
  if (appRemovalChange === undefined) {
    throw new Error('Could not find deployed application, failed to clean e2e changes')
  }
  await adapterAttr.adapter.deploy({
    changeGroup: {
      groupID: getChangeData(appRemovalChange).elemID.getFullName(),
      changes: [toChange({ before: getChangeData(appRemovalChange) })],
    },
    progressReporter: nullProgressReporter,
  })
}

describe('Okta adapter E2E', () => {
  describe('fetch and deploy', () => {
    let credLease: CredsLease<Credentials>
    let adapterAttr: Reals
    const testSuffix = uuidv4().slice(0, 8)
    let elements: Element[] = []
    let deployResults: DeployResult[]

    const deployAndFetch = async (instancesToAdd: InstanceElement[]): Promise<void> => {
      deployResults = await deployChanges(adapterAttr, instancesToAdd)
      const fetchResult = await adapterAttr.adapter.fetch({
        progressReporter: { reportProgress: () => null },
      })
      elements = fetchResult.elements
      // TODO: return this check when the second error is fixed
      // expect(fetchResult.errors).toHaveLength(1)
      // // The feature is disabled in our account
      // expect(fetchResult.errors).toEqual([
      //   {
      //     severity: 'Warning',
      //     message: "Salto could not access the api__v1__mappings resource. Elements from that type were not fetched. Please make sure that this type is enabled in your service, and that the supplied user credentials have sufficient permissions to access this data. You can also exclude this data from Salto's fetches by changing the environment configuration. Learn more at https://help.salto.io/en/articles/6947061-salto-could-not-access-the-resource",
      //   },
      // ])
      adapterAttr = realAdapter(
        { credentials: credLease.value, elementsSource: buildElementsSourceFromElements(elements) },
        DEFAULT_CONFIG,
      )
    }

    beforeAll(async () => {
      credLease = await credsLease()
      adapterAttr = realAdapter(
        { credentials: credLease.value, elementsSource: buildElementsSourceFromElements([]) },
        DEFAULT_CONFIG,
      )
      const firstFetchResult = await adapterAttr.adapter.fetch({
        progressReporter: { reportProgress: () => null },
      })

      adapterAttr = realAdapter(
        { credentials: credLease.value, elementsSource: buildElementsSourceFromElements(firstFetchResult.elements) },
        DEFAULT_CONFIG,
      )

      const types = firstFetchResult.elements.filter(isObjectType)
      const instancesToAdd = createInstancesForDeploy(types, testSuffix)
      await deployAndFetch(instancesToAdd)
    })

    afterAll(async () => {
      const appliedChanges = deployResults
        .flatMap(res => res.appliedChanges)
        .filter(isAdditionChange)
        .filter(isInstanceChange)

      // Application must be removed separately
      await removeApp(adapterAttr, appliedChanges)

      const removalChanges = appliedChanges
        // Application was removed in the prev step
        .filter(change => getChangeData(change).elemID.typeName !== APPLICATION_TYPE_NAME)
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
    })
    it('should fetch the regular instances and types', async () => {
      const expectedTypes = [
        'AccessPolicy',
        'AccessPolicyRule',
        'Application',
        'Authenticator',
        'AuthorizationServer',
        'AuthorizationServerPolicy',
        'AuthorizationServerPolicyRule',
        'OAuth2Scope',
        'OAuth2Claim',
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
        'OrgSetting',
        'Brand',
        'BrandTheme',
        'RateLimitAdminNotifications',
        'PerClientRateLimitSettings',
        'SmsTemplate',
        'TrustedOrigin',
        'UserSchema',
        'UserType',
        'GroupPush',
        'GroupPushRule',
        'Automation',
        'AutomationRule',
      ]
      const typesWithInstances = new Set([
        GROUP_TYPE_NAME,
        ROLE_TYPE_NAME,
        ACCESS_POLICY_TYPE_NAME,
        ACCESS_POLICY_RULE_TYPE_NAME,
        PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
        PROFILE_ENROLLMENT_RULE_TYPE_NAME,
        AUTHENTICATOR_TYPE_NAME,
        USER_SCHEMA_TYPE_NAME,
        USERTYPE_TYPE_NAME,
        APPLICATION_TYPE_NAME,
      ])

      const createdTypeNames = elements.filter(isObjectType).map(e => e.elemID.typeName)
      const createdInstances = elements.filter(isInstanceElement)
      expectedTypes.forEach(typeName => {
        expect(createdTypeNames).toContain(typeName)
        if (typesWithInstances.has(typeName)) {
          expect(createdInstances.filter(instance => instance.elemID.typeName === typeName).length).toBeGreaterThan(0)
        }
      })
      const orgSettingInst = createdInstances.filter(instance => instance.elemID.typeName === ORG_SETTING_TYPE_NAME)
      expect(orgSettingInst).toHaveLength(1) // OrgSetting is setting type
      // Validate subdomain field exist as we use it in many flows
      expect(orgSettingInst[0]?.value.subdomain).toBeDefined()
    })
    it('should fetch the newly deployed instances', async () => {
      const deployInstances = deployResults
        .map(res => res.appliedChanges)
        .flat()
        .map(change => getChangeData(change)) as InstanceElement[]

      deployInstances.forEach(deployedInstance => {
        const instance = elements.filter(isInstanceElement).find(e => e.elemID.isEqual(deployedInstance.elemID))
        expect(instance).toBeDefined()
        // Omit '_links' as this field is hidden
        expect(isEqualValues(_.omit(instance?.value, '_links'), deployedInstance.value)).toBeTruthy()
      })
    })
  })
})
