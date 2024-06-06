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
  isModificationChange,
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
  inspectValue,
  naclCase,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { definitions as definitionsUtils, fetch as fetchUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import {
  ACCESS_POLICY_RULE_TYPE_NAME,
  ACCESS_POLICY_TYPE_NAME,
  APP_GROUP_ASSIGNMENT_TYPE_NAME,
  APP_LOGO_TYPE_NAME,
  APP_USER_SCHEMA_TYPE_NAME,
  APPLICATION_TYPE_NAME,
  AUTHENTICATOR_TYPE_NAME,
  BRAND_THEME_TYPE_NAME,
  BRAND_TYPE_NAME,
  DOMAIN_TYPE_NAME,
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
import { createFetchDefinitions } from '../src/definitions/fetch/fetch'
import { DEFAULT_CONFIG } from '../src/user_config'
import { Credentials } from '../src/auth'
import { credsLease, realAdapter, Reals } from './adapter'
import { mockDefaultValues } from './mock_elements'
import OktaClient from '../src/client/client'
import { OktaFetchOptions } from '../src/definitions/types'

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
  const instValues = {
    ...mockDefaultValues[typeName],
    ...valuesOverride,
  }
  const type = types.find(t => t.elemID.typeName === typeName)
  if (type === undefined) {
    log.warn(`Could not find type ${typeName}, error while creating instance`)
    throw new Error(`Failed to find type ${typeName}`)
  }
  const fetchDefinitions = createFetchDefinitions(DEFAULT_CONFIG, true)
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

const getIdForDefaultBrand = async (client: OktaClient): Promise<string> => {
  const brandEntries = (await client.get({ url: '/api/v1/brands' })).data
  if (_.isArray(brandEntries) && brandEntries.length === 1 && _.isString(brandEntries[0].id)) {
    return brandEntries[0].id
  }
  log.error(`Received unexpected result for default brand: ${inspectValue(brandEntries)}`)
  throw new Error('Could not find default brand')
}

const getIdForDefaultBrandTheme = async (client: OktaClient, brandId: string): Promise<string> => {
  const themeEntries = (await client.get({ url: `/api/v1/brands/${brandId}/themes` })).data
  if (_.isArray(themeEntries) && themeEntries.length === 1 && _.isString(themeEntries[0].id)) {
    return themeEntries[0].id
  }
  log.error(`Received unexpected result for brand theme for brandId ${brandId}: ${inspectValue(themeEntries)}`)
  throw new Error('Could not find BrandTheme with the provided brandId')
}

const createBrandChangesForDeploy = async (
  types: ObjectType[],
  client: OktaClient,
): Promise<Change<InstanceElement>[]> => {
  const brandId = await getIdForDefaultBrand(client)
  const defaultBrand = createInstance({
    typeName: BRAND_TYPE_NAME,
    types,
    valuesOverride: {
      id: brandId,
    },
    name: 'unnamed_0',
  })
  const brand = createInstance({
    typeName: BRAND_TYPE_NAME,
    types,
    valuesOverride: {
      id: brandId,
      removePoweredByOkta: true,
      agreeToCustomPrivacyPolicy: false,
    },
    name: 'unnamed_0',
  })
  const brandThemeId = await getIdForDefaultBrandTheme(client, brandId)
  const defaultBrandTheme = createInstance({
    typeName: BRAND_THEME_TYPE_NAME,
    types,
    valuesOverride: {
      id: brandThemeId,
    },
    parent: defaultBrand,
    name: 'unnamed_0',
  })
  const brandTheme = createInstance({
    typeName: BRAND_THEME_TYPE_NAME,
    types,
    valuesOverride: {
      id: brandThemeId,
      primaryColorHex: '#abcabc',
      primaryColorContrastHex: '#000000',
      secondaryColorHex: '#abcabc',
      secondaryColorContrastHex: '#ffffff',
    },
    parent: brand,
    name: 'unnamed_0',
  })
  // The Domain creation API differs between paid and non-paid Okta accounts, and production code only supports the
  // paid account version, which requires an associated brand to create. There's a change validator that enforces this.
  // This e2e test runs in a non-paid Okta account, which doesn't support multiple brands.
  // However, conveniently, the domain creation API works in non-paid account only if we _don't_ provide a brand ID.
  // And even more conveniently, this e2e test doesn't run any change validator prior to deploying.
  // We use this to create a domain here without a brand ID, even though it's not supported in production code.
  // This allows us to both test the domain deploy actions (even if they're not exactly like production), but moreover
  // it allows us to test custom page creation, which requires a custom domain to exist.
  const domain = createInstance({
    typeName: DOMAIN_TYPE_NAME,
    types,
    valuesOverride: {
      domain: 'subdomain.salto.io',
    },
  })
  return [
    toChange({ before: defaultBrand, after: brand }),
    toChange({ before: defaultBrandTheme, after: brandTheme }),
    toChange({ after: domain }),
  ]
}

const createChangesForDeploy = async (
  types: ObjectType[],
  testSuffix: string,
  client: OktaClient,
): Promise<Change[]> => {
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
  const accessPolicyRule = createInstance({
    typeName: ACCESS_POLICY_RULE_TYPE_NAME,
    types,
    valuesOverride: {
      name: createName('policyRule'),
      conditions: {
        network: {
          connection: 'ANYWHERE',
          // TODO SALTO-5780 - return reference to zone once resolved
          // connection: 'ZONE',
          // include: [new ReferenceExpression(zoneInstance.elemID, zoneInstance)],
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
    name: naclCase(`${app.elemID.name}__${groupInstance.elemID.name}`),
  })
  return [
    toChange({ after: groupInstance }),
    toChange({ after: anotherGroupInstance }),
    toChange({ after: ruleInstance }),
    toChange({ after: zoneInstance }),
    toChange({ after: accessPolicy }),
    toChange({ after: accessPolicyRule }),
    toChange({ after: profileEnrollment }),
    toChange({ after: profileEnrollmentRule }),
    toChange({ after: app }),
    toChange({ after: appGroupAssignment }),
    ...(await createBrandChangesForDeploy(types, client)),
  ]
}

const nullProgressReporter: ProgressReporter = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
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

const getChangesForInitialCleanup = async (
  elements: Element[],
  types: ObjectType[],
  client: OktaClient,
): Promise<Change<InstanceElement>[]> => {
  const removalChanges: Change<InstanceElement>[] = elements
    .filter(isInstanceElement)
    .filter(inst => inst.elemID.name.startsWith(TEST_PREFIX) || inst.elemID.typeName === DOMAIN_TYPE_NAME)
    .filter(inst => ![APP_USER_SCHEMA_TYPE_NAME, APP_LOGO_TYPE_NAME].includes(inst.elemID.typeName))
    .map(instance => toChange({ before: instance }))

  // Brand related instances don't have the test prefix, so we reverse them explicitly.
  const reversedBrandChanges: Change<InstanceElement>[] = (await createBrandChangesForDeploy(types, client))
    .filter(isModificationChange) // We can't reverse "add" actions because we'd need the service ID.
    .map(change =>
      toChange({
        before: change.data.after,
        after: change.data.before,
      }),
    )

  const cleanupChanges = [...removalChanges, ...reversedBrandChanges]

  log.info(
    'Cleaning up the environment before starting e2e test: %s',
    cleanupChanges.map(change => getChangeData(change).elemID.getFullName()),
  )
  return cleanupChanges
}

const deployCleanup = async (adapterAttr: Reals, types: ObjectType[], elements: InstanceElement[]): Promise<void> => {
  log.debug('Cleaning up the environment before starting e2e test')
  const cleanupChanges = await getChangesForInitialCleanup(elements, types, adapterAttr.client)
  const removals = cleanupChanges.filter(change => getChangeData(change).elemID.typeName !== APPLICATION_TYPE_NAME)
  await removeAllApps(adapterAttr, cleanupChanges)
  await deployChanges(adapterAttr, removals)
  log.debug('Environment cleanup successful')
}

const getHiddenFieldsToOmit = (
  fetchDefinitions: definitionsUtils.fetch.FetchApiDefinitions<OktaFetchOptions>,
  typeName: string,
): string[] => {
  const customizations = definitionsUtils.queryWithDefault(fetchDefinitions.instances).query(typeName)
    ?.element?.fieldCustomizations
  return Object.entries(customizations ?? {})
    .filter(([, customization]) => customization.hide === true)
    .map(([fieldName]) => fieldName)
    .filter(fieldName => fieldName !== 'id')
}

describe('Okta adapter E2E', () => {
  describe('fetch and deploy', () => {
    let credLease: CredsLease<Credentials>
    let adapterAttr: Reals
    const testSuffix = uuidv4().slice(0, 8)
    let elements: Element[] = []
    let deployResults: DeployResult[]
    let fetchDefinitions: definitionsUtils.fetch.FetchApiDefinitions<OktaFetchOptions>

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
      fetchDefinitions = createFetchDefinitions(DEFAULT_CONFIG, true)
      const types = fetchBeforeCleanupResult.elements.filter(isObjectType)
      await deployCleanup(adapterAttr, types, fetchBeforeCleanupResult.elements.filter(isInstanceElement))

      const changesToDeploy = await createChangesForDeploy(types, testSuffix, adapterAttr.client)
      await deployAndFetch(changesToDeploy)
    })

    afterAll(async () => {
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
