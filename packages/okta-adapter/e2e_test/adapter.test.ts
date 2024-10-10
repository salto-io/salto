/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  invertNaclCase,
  naclCase,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { definitions as definitionsUtils, fetch as fetchUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import {
  ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME,
  ACCESS_POLICY_RULE_TYPE_NAME,
  ACCESS_POLICY_TYPE_NAME,
  APP_GROUP_ASSIGNMENT_TYPE_NAME,
  APP_LOGO_TYPE_NAME,
  APP_USER_SCHEMA_TYPE_NAME,
  APPLICATION_TYPE_NAME,
  AUTHENTICATOR_TYPE_NAME,
  BRAND_THEME_TYPE_NAME,
  BRAND_TYPE_NAME,
  CUSTOM_NAME_FIELD,
  DOMAIN_TYPE_NAME,
  GROUP_RULE_TYPE_NAME,
  GROUP_TYPE_NAME,
  IDENTITY_PROVIDER_TYPE_NAME,
  INACTIVE_STATUS,
  NETWORK_ZONE_TYPE_NAME,
  ORG_SETTING_TYPE_NAME,
  PASSWORD_POLICY_PRIORITY_TYPE_NAME,
  PASSWORD_POLICY_TYPE_NAME,
  PASSWORD_RULE_PRIORITY_TYPE_NAME,
  PASSWORD_RULE_TYPE_NAME,
  PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
  PROFILE_ENROLLMENT_RULE_TYPE_NAME,
  ROLE_TYPE_NAME,
  USER_SCHEMA_TYPE_NAME,
  USERTYPE_TYPE_NAME,
} from '../src/constants'
import { createFetchDefinitions } from '../src/definitions/fetch/fetch'
import { DEFAULT_CONFIG } from '../src/user_config'
import { Credentials } from '../src/auth'
import { credsLease, realAdapter, Reals } from './adapter'
import { mockDefaultValues } from './mock_elements'
import { OktaOptions } from '../src/definitions/types'
import { createFetchQuery } from '../test/utils'

const { awu } = collections.asynciterable
const log = logger(module)

// Set long timeout as we communicate with Okta APIs
jest.setTimeout(1000 * 60 * 10)

const TEST_PREFIX = 'Test'

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
  const instValues = _.merge({}, mockDefaultValues[typeName], valuesOverride)
  const type = types.find(t => t.elemID.typeName === typeName)
  if (type === undefined) {
    log.warn(`Could not find type ${typeName}, error while creating instance`)
    throw new Error(`Failed to find type ${typeName}`)
  }
  const fetchDefinitions = createFetchDefinitions({
    userConfig: DEFAULT_CONFIG,
    fetchQuery: createFetchQuery(DEFAULT_CONFIG),
    usePrivateAPI: true,
  })
  const elemIDDef = definitionsUtils.queryWithDefault(fetchDefinitions.instances).query(typeName)?.element
    ?.topLevel?.elemID
  if (elemIDDef === undefined) {
    log.warn(`Could not find type elemID definitions for type ${typeName}, error while creating instance`)
    throw new Error(`Could not find type elemID definitions for type ${typeName}`)
  }
  const elemIDFunc = fetchUtils.element.createElemIDFunc<never>({ elemIDDef, typeID: type.elemID })
  const elemID = elemIDFunc({ entry: instValues, defaultName: 'unnamed_0', parent })
  return new InstanceElement(
    name ? naclCase(name) : elemID,
    type,
    instValues,
    undefined,
    parent ? { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] } : undefined,
  )
}

const createChangesForDeploy = async (types: ObjectType[], testSuffix: string): Promise<Change[]> => {
  const createName = (type: string): string => `${TEST_PREFIX}${type}${testSuffix}`

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
  const accessPolicyRuleA = createInstance({
    typeName: ACCESS_POLICY_RULE_TYPE_NAME,
    types,
    valuesOverride: {
      name: createName('policyRuleA'),
      conditions: {
        network: {
          connection: 'ANYWHERE',
          // TODO SALTO-5780 - return reference to zone once resolved
          // connection: 'ZONE',
          // include: [new ReferenceExpression(zoneInstance.elemID, zoneInstance)],
        },
        riskScore: { level: 'MEDIUM' },
      },
    },
    parent: accessPolicy,
  })
  const accessPolicyRuleB = createInstance({
    typeName: ACCESS_POLICY_RULE_TYPE_NAME,
    types,
    valuesOverride: {
      name: createName('policyRuleB'),
      conditions: {
        network: { connection: 'ANYWHERE' },
        riskScore: { level: 'ANY' },
        platform: {
          include: [
            {
              type: 'DESKTOP',
              os: {
                type: 'MACOS',
              },
            },
            {
              type: 'MOBILE',
              os: {
                type: 'ANDROID',
              },
            },
          ],
        },
      },
    },
    parent: accessPolicy,
  })
  const defaultRule = createInstance({
    typeName: ACCESS_POLICY_RULE_TYPE_NAME,
    types,
    valuesOverride: {
      name: 'Catch-all Rule',
      system: true,
      actions: {
        appSignOn: {
          access: 'DENY',
          verificationMethod: {
            factorMode: '1FA',
            type: 'ASSURANCE',
            reauthenticateIn: 'PT12H',
            constraints: [
              {
                knowledge: {
                  types: ['password'],
                },
              },
            ],
          },
        },
      },
    },
    parent: accessPolicy,
  })
  const accessPolicyRulePriority = createInstance({
    typeName: ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME,
    types,
    name: naclCase(`${invertNaclCase(accessPolicy.elemID.name)}_priority`),
    valuesOverride: {
      priorities: [
        new ReferenceExpression(accessPolicyRuleB.elemID, accessPolicyRuleB),
        new ReferenceExpression(accessPolicyRuleA.elemID, accessPolicyRuleA),
      ],
      defaultRule: new ReferenceExpression(defaultRule.elemID, defaultRule),
    },
    parent: accessPolicy,
  })
  const passwordPolicyA = createInstance({
    typeName: PASSWORD_POLICY_TYPE_NAME,
    types,
    valuesOverride: {
      name: createName('passwordPolicyA'),
      conditions: {
        people: {
          groups: {
            include: [new ReferenceExpression(groupInstance.elemID, groupInstance)],
          },
        },
        authProvider: {
          provider: 'OKTA',
        },
      },
      settings: {
        password: {
          complexity: {
            minLength: 16,
          },
        },
      },
    },
  })
  const passwordPolicyB = createInstance({
    typeName: PASSWORD_POLICY_TYPE_NAME,
    types,
    valuesOverride: {
      name: createName('passwordPolicyB'),
      conditions: {
        people: {
          groups: {
            include: [new ReferenceExpression(groupInstance.elemID, groupInstance)],
          },
        },
        authProvider: { provider: 'OKTA' },
      },
    },
  })
  const defaultPasswordPolicy = createInstance({
    typeName: PASSWORD_POLICY_TYPE_NAME,
    name: 'Default Policy',
    types,
    valuesOverride: { name: 'Default Policy', system: true },
  })
  const passwordPolicyPriority = createInstance({
    typeName: PASSWORD_POLICY_PRIORITY_TYPE_NAME,
    types,
    name: 'PasswordPolicy_priority',
    valuesOverride: {
      priorities: [
        new ReferenceExpression(passwordPolicyB.elemID, passwordPolicyB),
        new ReferenceExpression(passwordPolicyA.elemID, passwordPolicyA),
      ],
      defaultPolicy: new ReferenceExpression(defaultPasswordPolicy.elemID, defaultPasswordPolicy),
    },
  })
  const passwordPolicyRuleA = createInstance({
    typeName: PASSWORD_RULE_TYPE_NAME,
    types,
    valuesOverride: {
      name: createName('passwordRuleA'),
    },
    parent: passwordPolicyA,
  })
  const passwordPolicyRuleB = createInstance({
    typeName: PASSWORD_RULE_TYPE_NAME,
    types,
    valuesOverride: {
      name: createName('passwordRuleB'),
    },
    parent: passwordPolicyA,
  })
  const passwordPolicyRulePriority = createInstance({
    typeName: PASSWORD_RULE_PRIORITY_TYPE_NAME,
    types,
    name: naclCase(`${invertNaclCase(passwordPolicyA.elemID.name)}_priority`),
    valuesOverride: {
      priorities: [
        new ReferenceExpression(passwordPolicyRuleB.elemID, passwordPolicyRuleB),
        new ReferenceExpression(passwordPolicyRuleA.elemID, passwordPolicyRuleA),
      ],
    },
    parent: passwordPolicyA,
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
    name: naclCase(`${app.elemID.name}__${groupInstance.elemID.name}`),
  })
  const brand = createInstance({
    typeName: BRAND_TYPE_NAME,
    types,
    valuesOverride: {
      name: createName('brand'),
      // Brand addition is split into two calls (`add` with name, `modify` with
      // other fields), so we override some arbitrary value to cover both calls.
      removePoweredByOkta: true,
    },
  })
  const identityProvider = createInstance({
    typeName: IDENTITY_PROVIDER_TYPE_NAME,
    types,
    valuesOverride: {
      name: createName(IDENTITY_PROVIDER_TYPE_NAME),
    },
  })
  return [
    toChange({ after: groupInstance }),
    toChange({ after: anotherGroupInstance }),
    toChange({ after: ruleInstance }),
    toChange({ after: zoneInstance }),
    toChange({ after: accessPolicy }),
    toChange({ after: accessPolicyRuleA }),
    toChange({ after: accessPolicyRuleB }),
    toChange({ after: defaultRule }),
    toChange({ after: accessPolicyRulePriority }),
    toChange({ after: passwordPolicyA }),
    toChange({ after: passwordPolicyRuleA }),
    toChange({ after: passwordPolicyRuleB }),
    toChange({ after: passwordPolicyB }),
    toChange({ after: passwordPolicyPriority }),
    toChange({ after: passwordPolicyRulePriority }),
    toChange({ after: profileEnrollment }),
    toChange({ after: profileEnrollmentRule }),
    toChange({ after: app }),
    toChange({ after: appGroupAssignment }),
    toChange({ after: brand }),
    toChange({ after: identityProvider }),
  ]
}

const nullProgressReporter: ProgressReporter = {
  reportProgress: () => {},
}

const deployChanges = async (adapterAttr: Reals, changes: Change[]): Promise<DeployResult[]> => {
  const planElementById = _.keyBy(changes.map(getChangeData), inst => inst.elemID.getFullName())
  return awu(changes)
    .map(async change => {
      log.debug('Deploying change for %s (%s)', getChangeData(change).elemID.getFullName(), change.action)
      const deployResult = await adapterAttr.adapter.deploy({
        changeGroup: { groupID: getChangeData(change).elemID.getFullName(), changes: [change] },
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
}

const removeAllApps = async (adapterAttr: Reals, changes: Change<InstanceElement>[]): Promise<void> => {
  await awu(changes)
    .map(change => getChangeData(change))
    .filter(inst => inst.elemID.typeName === APPLICATION_TYPE_NAME)
    .forEach(async activeApp => {
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
    })
}

const getChangesForInitialCleanup = async (elements: Element[]): Promise<Change<InstanceElement>[]> => {
  const removalChanges: Change<InstanceElement>[] = elements
    .filter(isInstanceElement)
    .filter(inst => inst.elemID.name.startsWith(TEST_PREFIX))
    .filter(inst => ![APP_USER_SCHEMA_TYPE_NAME, APP_LOGO_TYPE_NAME].includes(inst.elemID.typeName))
    .map(instance => toChange({ before: instance }))

  log.info(
    'Cleaning up the environment before starting e2e test: %s',
    removalChanges.map(change => getChangeData(change).elemID.getFullName()),
  )
  return removalChanges
}

const deployCleanup = async (adapterAttr: Reals, elements: InstanceElement[]): Promise<void> => {
  log.debug('Cleaning up the environment before starting e2e test')
  const cleanupChanges = await getChangesForInitialCleanup(elements)
  const removals = cleanupChanges.filter(change => getChangeData(change).elemID.typeName !== APPLICATION_TYPE_NAME)
  await removeAllApps(adapterAttr, cleanupChanges)
  await deployChanges(adapterAttr, removals)
  log.debug('Environment cleanup successful')
}

const getHiddenFieldsToOmit = (
  fetchDefinitions: definitionsUtils.fetch.FetchApiDefinitions<OktaOptions>,
  typeName: string,
): string[] => {
  const customizations = definitionsUtils.queryWithDefault(fetchDefinitions.instances).query(typeName)
    ?.element?.fieldCustomizations
  return (
    Object.entries(customizations ?? {})
      .filter(([, customization]) => customization.hide === true)
      .map(([fieldName]) => fieldName)
      // ignore fields that are written to nacl after deployment
      .filter(fieldName => !['id', CUSTOM_NAME_FIELD].includes(fieldName))
  )
}

describe('Okta adapter E2E', () => {
  describe('fetch and deploy', () => {
    let credLease: CredsLease<Credentials>
    let adapterAttr: Reals
    const testSuffix = uuidv4().slice(0, 8)
    let elements: Element[] = []
    let deployResults: DeployResult[]
    let fetchDefinitions: definitionsUtils.fetch.FetchApiDefinitions<OktaOptions>

    const deployAndFetch = async (changes: Change[]): Promise<void> => {
      deployResults = await deployChanges(adapterAttr, changes)
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
      log.resetLogCount()
      credLease = await credsLease()
      adapterAttr = realAdapter(
        { credentials: credLease.value, elementsSource: buildElementsSourceFromElements([]) },
        DEFAULT_CONFIG,
      )
      const fetchBeforeCleanupResult = await adapterAttr.adapter.fetch({
        progressReporter: { reportProgress: () => null },
      })
      fetchDefinitions = createFetchDefinitions({
        userConfig: DEFAULT_CONFIG,
        fetchQuery: createFetchQuery(DEFAULT_CONFIG),
        usePrivateAPI: true,
      })
      const types = fetchBeforeCleanupResult.elements.filter(isObjectType)
      await deployCleanup(adapterAttr, fetchBeforeCleanupResult.elements.filter(isInstanceElement))

      const changesToDeploy = await createChangesForDeploy(types, testSuffix)
      await deployAndFetch(changesToDeploy)
    })

    afterAll(async () => {
      log.info('Starting cleanup')
      const appliedChanges = deployResults
        .flatMap(res => res.appliedChanges)
        .filter(isAdditionChange)
        .filter(isInstanceChange)

      // Application must be removed separately
      await removeAllApps(adapterAttr, appliedChanges)

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
      log.info('Okta adapter E2E: Log counts = %o', log.getLogCount())
    })
    describe('fetch the regular instances and types', () => {
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
        'OrgSetting',
        'Brand',
        'BrandTheme',
        'EmailTemplate',
        'Domain',
        'RateLimitAdminNotifications',
        'PerClientRateLimitSettings',
        'SmsTemplate',
        'TrustedOrigin',
        'UserSchema',
        'UserType',
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
        BRAND_TYPE_NAME,
        BRAND_THEME_TYPE_NAME,
        DOMAIN_TYPE_NAME,
      ])

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
      it('should fetch OrgSetting and validate subdomain field', async () => {
        const orgSettingInst = createdInstances.filter(instance => instance.elemID.typeName === ORG_SETTING_TYPE_NAME)
        expect(orgSettingInst).toHaveLength(1) // OrgSetting is setting type
        // Validate subdomain field exist as we use it in many flows
        expect(orgSettingInst[0]?.value.subdomain).toBeDefined()
      })
    })
    it('should fetch the newly deployed instances', async () => {
      const deployInstances = deployResults
        .map(res => res.appliedChanges)
        .flat()
        .map(change => getChangeData(change))
        .filter(isInstanceElement)

      elements.filter(isInstanceElement).forEach(e => log.trace('Instance %s', e.elemID.getFullName()))

      deployInstances.forEach(deployedInstance => {
        log.trace('Checking instance %s', deployedInstance.elemID.getFullName())
        const instance = elements.filter(isInstanceElement).find(e => e.elemID.isEqual(deployedInstance.elemID))
        expect(instance).toBeDefined()
        // Omit hidden fields that are not written to nacl after deployment
        const fieldsToOmit = getHiddenFieldsToOmit(fetchDefinitions, deployedInstance.elemID.typeName)
        const originalValue = _.omit(instance?.value, fieldsToOmit)
        expect(originalValue).toHaveEqualValues(deployedInstance)
      })
    })
  })
})
