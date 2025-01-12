/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { logger } from '@salto-io/logging'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import {
  adapter,
  Credentials,
  CUSTOM_FIELD_OPTIONS_FIELD_NAME,
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_NAME,
  GROUP_TYPE_NAME,
  GUIDE_SUPPORTED_TYPES,
  GUIDE_THEME_TYPE_NAME,
  GUIDE_TYPES_TO_HANDLE_BY_BRAND,
  THEME_SETTINGS_TYPE_NAME,
  ZENDESK,
} from '@salto-io/zendesk-adapter'
import { Workspace, ValidationError } from '@salto-io/workspace'
import { initLocalWorkspace } from '@salto-io/local-workspace'
import { addAdapter, deploy, fetch, getDefaultAdapterConfig, preview, updateCredentials } from '@salto-io/core'
import {
  DetailedChangeWithBaseChange,
  Element,
  ElemID,
  InstanceElement,
  isInstanceElement,
  isObjectType,
  isReferenceExpression,
  isStaticFile,
  isTemplateExpression,
  ReferenceExpression,
  StaticFile,
  toChange,
  Value,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import tmp from 'tmp-promise'
import _, { isArray, isPlainObject } from 'lodash'
import { getDetailedChanges } from '@salto-io/adapter-utils'
import { credsLease } from './adapter'
import {
  getAllInstancesToDeploy,
  HELP_CENTER_BRAND_NAME,
  HIDDEN_PER_TYPE,
  TYPES_NOT_TO_REMOVE,
  UNIQUE_NAME,
} from './e2e_utils'

const log = logger(module)
const { awu } = collections.asynciterable

// Set long timeout as we communicate with Zendesk APIs
jest.setTimeout(1000 * 60 * 15)

const FETCH_CONFIG_OVERRIDE = {
  guide: {
    brands: ['.*'],
    themes: {
      brands: ['.*'],
      referenceOptions: {
        enableReferenceLookup: false,
      },
    },
  },
  exclude: [],
}

const adapterCreators = {
  zendesk: adapter,
}

const updateConfig = async ({
  workspace,
  adapterName,
  fetchAddition,
}: {
  workspace: Workspace
  adapterName: string
  fetchAddition: Record<string, unknown>
}): Promise<void> => {
  const defaultConfig = await getDefaultAdapterConfig({ adapterName, accountName: adapterName, adapterCreators })
  if (!_.isUndefined(defaultConfig)) {
    defaultConfig[0].value.fetch = { ...defaultConfig[0].value.fetch, ...fetchAddition }
    await workspace.updateAccountConfig(adapterName, defaultConfig, adapterName)
  }
}

const initWorkspace = async ({
  envName,
  credLease,
  adapterName,
}: {
  envName: string
  credLease: CredsLease<Credentials>
  adapterName: string
}): Promise<Workspace> => {
  const baseDir = (await tmp.dir()).path
  console.log(baseDir)
  const workspace = await initLocalWorkspace({ baseDir, envName, adapterCreators })
  await workspace.setCurrentEnv(envName, false)
  const authMethods = adapter.authenticationMethods
  const configType = authMethods.basic
  const { credentialsType } = configType
  const newConfig = new InstanceElement(ElemID.CONFIG_NAME, credentialsType, credLease.value)
  await updateCredentials(workspace, newConfig, adapterName)
  await updateConfig({
    workspace,
    adapterName,
    fetchAddition: FETCH_CONFIG_OVERRIDE,
  })
  await addAdapter({ workspace, adapterName, adapterCreators })
  await workspace.flush()
  return workspace
}

const getElementsFromWorkspace = async (workspace: Workspace): Promise<Element[]> => {
  const elementsSource = await workspace.elements()
  return awu(await elementsSource.getAll()).toArray()
}

// we remove elements and we don't modify the order that point at them
// we cannot remove support address as it is the default, therefore when we remove the brand the support address gets validation error
const zendeskValidationFilter = (error: ValidationError): boolean =>
  !(error.elemID.typeName.includes('order') || error.elemID.typeName.includes('support_address'))

const updateWorkspace = async (
  workspace: Workspace,
  changes: DetailedChangeWithBaseChange[],
  validationFilter: (error: ValidationError) => boolean = () => true,
): Promise<void> => {
  await workspace.updateNaclFiles(changes)
  const err = await workspace.errors()
  expect(err.parse.length > 0).toBeFalsy()
  expect(err.merge.length > 0).toBeFalsy()
  expect(err.validation.filter(error => validationFilter(error)).length > 0).toBeFalsy()
  await workspace.flush()
}

const fetchWorkspace = async (workspace: Workspace): Promise<void> => {
  const res = await fetch({ workspace, adapterCreators })
  expect(res.success).toBeTruthy()
  await updateWorkspace(
    workspace,
    res.changes.map(c => c.change),
    zendeskValidationFilter,
  )
}

const getAdditionDetailedChangesFromInstances = (instances: InstanceElement[]): DetailedChangeWithBaseChange[] => {
  const changes = instances.map(inst => toChange({ after: inst }))
  return changes.flatMap(change => getDetailedChanges(change))
}

const getDeletionDetailedChangesFromInstances = (instances: InstanceElement[]): DetailedChangeWithBaseChange[] => {
  const changes = instances.map(inst => toChange({ before: inst }))
  return changes.flatMap(change => getDetailedChanges(change))
}

const e2eDeploy = async (workspace: Workspace, detailedChanges: DetailedChangeWithBaseChange[]): Promise<void> => {
  await updateWorkspace(workspace, detailedChanges, zendeskValidationFilter)
  const actionPlan = await preview({ workspace, adapterCreators })
  const result = await deploy({ workspace, actionPlan, reportProgress: () => {}, adapterCreators })
  expect(result.errors.length).toEqual(0)
  expect(result.changes).toBeDefined()
  await updateWorkspace(
    workspace,
    Array.from(result.changes ?? []).map(c => c.change),
    zendeskValidationFilter,
  )
  const actionPlan2 = await preview({ workspace, adapterCreators })
  expect(actionPlan2.size).toEqual(0)
}

const zendeskCleanUp = async (instances: InstanceElement[], workspace: Workspace): Promise<void> => {
  const detailedChangesToClean = getDeletionDetailedChangesFromInstances(
    instances
      .filter(instance => !TYPES_NOT_TO_REMOVE.has(instance.elemID.typeName))
      .filter(instance => instance.elemID.name.includes(UNIQUE_NAME)),
  )
  if (detailedChangesToClean.length > 0) {
    await e2eDeploy(workspace, detailedChangesToClean)
  }
  // consider adding another fetch
}

const filterHiddenFields = (instances: InstanceElement[]): InstanceElement[] => {
  return instances
    .map(inst => inst.clone())
    .map(inst => {
      const hiddenFields = HIDDEN_PER_TYPE[inst.elemID.typeName]
      if (hiddenFields) {
        hiddenFields.forEach(field => {
          delete inst.value[field]
        })
      }
      return inst
    })
}

const verifyArray = (orgArray: Array<unknown>, fetchArray: Array<unknown>): void => {
  const orgVals = orgArray.map(val => (isReferenceExpression(val) ? val.elemID.getFullName() : val))
  const fetchVals = fetchArray.map(val => (isReferenceExpression(val) ? val.elemID.getFullName() : val))
  expect(orgVals).toEqual(fetchVals)
}

const verifyStaticFile = (orgStaticFile: StaticFile, fetchStaticFile: StaticFile): void => {
  expect(orgStaticFile.filepath).toEqual(fetchStaticFile.filepath)
  expect(orgStaticFile.encoding).toEqual(fetchStaticFile.encoding)
  expect(orgStaticFile.hash).toEqual(fetchStaticFile.hash)
}

const verifyInstanceValues = (
  fetchInstance: InstanceElement | undefined,
  orgInstance: InstanceElement,
  fieldsToCheck: string[],
): void => {
  expect(fetchInstance).toBeDefined()
  if (fetchInstance === undefined) {
    return
  }
  const orgInstanceValues = orgInstance.value
  const fetchInstanceValues = _.pick(fetchInstance.value, fieldsToCheck)
  fieldsToCheck.forEach(field => {
    if (isReferenceExpression(orgInstanceValues[field]) && isReferenceExpression(fetchInstanceValues[field])) {
      expect(fetchInstanceValues[field].elemID.getFullName()).toEqual(orgInstanceValues[field].elemID.getFullName())
    } else if (isArray(orgInstanceValues[field]) && isArray(fetchInstanceValues[field])) {
      verifyArray(orgInstanceValues[field], fetchInstanceValues[field])
    } else if (isTemplateExpression(orgInstanceValues[field]) && isTemplateExpression(fetchInstanceValues[field])) {
      verifyArray(orgInstanceValues[field].parts, fetchInstanceValues[field].parts)
    } else if (isPlainObject(orgInstanceValues[field]) && isPlainObject(fetchInstanceValues[field])) {
      const fields = Object.keys(orgInstanceValues[field])
      expect(_.pick(fetchInstanceValues[field], fields)).toEqual(orgInstanceValues[field])
    } else if (isStaticFile(orgInstanceValues[field]) && isStaticFile(fetchInstanceValues[field])) {
      verifyStaticFile(orgInstanceValues[field], fetchInstanceValues[field])
    } else {
      expect(fetchInstanceValues[field]).toEqual(orgInstanceValues[field])
    }
  })
}

describe('Zendesk adapter E2E - 2', () => {
  describe('fetch and deploy', () => {
    let credLease: CredsLease<Credentials>
    let elements: Element[]
    let instancesToDeploy: InstanceElement[]
    let guideInstances: InstanceElement[]
    let guideThemeInstance: InstanceElement
    let workspace: Workspace

    const getElementsAfterFetch = (
      originalInstances: InstanceElement[],
    ): Record<string, InstanceElement | undefined> => {
      const nameToElemId = _.keyBy(originalInstances, instance => instance.elemID.getFullName())
      return _.mapValues(nameToElemId, instance => {
        const val = elements.filter(isInstanceElement).find(e => instance.elemID.isEqual(e.elemID))
        expect(val).toBeDefined()
        return val
      })
    }

    beforeAll(async () => {
      log.resetLogCount()
      credLease = await credsLease()
      workspace = await initWorkspace({ envName: 'zendesk-env', adapterName: 'zendesk', credLease })
      await fetchWorkspace(workspace)
      const firstFetchInstances = (await getElementsFromWorkspace(workspace)).filter(isInstanceElement)
      const brandInstanceE2eHelpCenter = firstFetchInstances.find(e => e.elemID.name === HELP_CENTER_BRAND_NAME)
      const defaultGroup = firstFetchInstances.find(
        e => e.elemID.typeName === GROUP_TYPE_NAME && e.value.default === true,
      )
      expect(defaultGroup).toBeDefined()
      expect(brandInstanceE2eHelpCenter).toBeDefined()
      if (brandInstanceE2eHelpCenter == null || defaultGroup == null) {
        return
      }
      await zendeskCleanUp(firstFetchInstances, workspace)
      ;({ instancesToDeploy, guideInstances, guideThemeInstance } = await getAllInstancesToDeploy({
        brandInstanceE2eHelpCenter,
        defaultGroup,
      }))

      // we remove hidden fields as they cannot be deployed
      const noHiddenInstancesToDeploy = filterHiddenFields(instancesToDeploy)
      const detailedChanges = getAdditionDetailedChangesFromInstances(noHiddenInstancesToDeploy)
      await e2eDeploy(workspace, detailedChanges)
      await fetchWorkspace(workspace)
      elements = await getElementsFromWorkspace(workspace)
    })

    afterAll(async () => {
      await zendeskCleanUp(elements.filter(isInstanceElement), workspace)
      if (credLease.return) {
        await credLease.return()
      }
      log.info('Zendesk adapter E2E: Log counts = %o', log.getLogCount())
    })

    it('should fetch the regular instances and types', async () => {
      const typesToFetch = [
        'account_features',
        'account_setting',
        'app_installation',
        'automation',
        'brand',
        'brand_logo',
        'business_hours_schedule',
        'custom_role',
        'dynamic_content_item',
        'group',
        'layout',
        'locale',
        'macro_categories',
        'macro',
        'oauth_client',
        'oauth_global_client',
        'organization',
        'organization_field',
        'queue',
        'routing_attribute',
        'sharing_agreement',
        'sla_policy',
        'support_address',
        'target',
        'ticket_field',
        'ticket_form',
        'trigger_category',
        'trigger',
        'user_field',
        'view',
        'workspace',
        GUIDE_THEME_TYPE_NAME,
        THEME_SETTINGS_TYPE_NAME,
      ]
      const typeNames = elements.filter(isObjectType).map(e => e.elemID.typeName)
      const instances = elements.filter(isInstanceElement)
      typesToFetch.forEach(typeName => {
        expect(typeNames).toContain(typeName)
        const instance = instances.find(e => e.elemID.typeName === typeName)
        expect(instance).toBeDefined()
      })
    })
    it('should fetch order elements', async () => {
      const orderElements = [
        'workspace_order',
        'user_field_order',
        'organization_field_order',
        'ticket_form_order',
        'sla_policy_order',
        'queue_order',
      ]
      const orderElementsElemIDs = orderElements.map(name => ({
        type: new ElemID(ZENDESK, name),
        instance: new ElemID(ZENDESK, name, 'instance', ElemID.CONFIG_NAME),
      }))
      orderElementsElemIDs.forEach(element => {
        const type = elements.find(e => e.elemID.isEqual(element.type))
        expect(type).toBeDefined()
        const instance = elements.find(e => e.elemID.isEqual(element.instance))
        expect(instance).toBeDefined()
      })
    })
    it('should fetch the newly deployed instances', async () => {
      const instances = instancesToDeploy
      instances
        .filter(
          inst =>
            !['ticket_field', 'user_field', ...GUIDE_TYPES_TO_HANDLE_BY_BRAND, GUIDE_THEME_TYPE_NAME].includes(
              inst.elemID.typeName,
            ),
        )
        .forEach(instanceToAdd => {
          const instance = elements.find(e => e.elemID.isEqual(instanceToAdd.elemID))
          expect(instance).toBeDefined()
          // custom object types have circular references (value and parent)
          // toMatchObject does not work well with circular references and crashes
          if ([CUSTOM_OBJECT_TYPE_NAME, CUSTOM_OBJECT_FIELD_TYPE_NAME].includes(instanceToAdd.elemID.typeName)) {
            const instanceClone = (instance as InstanceElement).clone()
            const instanceToAddClone = instanceToAdd.clone()
            const fieldToHandle =
              instanceClone.elemID.typeName === CUSTOM_OBJECT_TYPE_NAME
                ? `${CUSTOM_OBJECT_FIELD_TYPE_NAME}s`
                : CUSTOM_FIELD_OPTIONS_FIELD_NAME

            instanceClone.value[fieldToHandle] = (instanceClone.value[fieldToHandle] ?? [])
              .map((ref: ReferenceExpression) => ref.elemID.getFullName())
              .sort()
            instanceToAddClone.value[fieldToHandle] = (instanceToAddClone.value[fieldToHandle] ?? [])
              .map((ref: ReferenceExpression) => ref.elemID.getFullName())
              .sort()

            expect(instanceClone.value).toMatchObject(instanceToAddClone.value)
          } else {
            const fieldsToCheck = Object.keys(instanceToAdd.value)
            verifyInstanceValues(instance as InstanceElement, instanceToAdd, fieldsToCheck)
          }
        })
    })
    it('should fetch ticket_field correctly', async () => {
      const instances = instancesToDeploy
      instances
        .filter(inst => inst.elemID.typeName === 'ticket_field')
        .forEach(instanceToAdd => {
          const instance = elements.find(e => e.elemID.isEqual(instanceToAdd.elemID)) as InstanceElement
          expect(instance).toBeDefined()
          expect(_.omit(instance.value, ['custom_field_options', 'default_custom_field_option'])).toMatchObject(
            _.omit(instanceToAdd.value, ['custom_field_options', 'default_custom_field_option']),
          )
          expect(instance.value.default_custom_field_option).toBeInstanceOf(ReferenceExpression)
          expect(instance.value.default_custom_field_option.elemID.getFullName()).toEqual(
            instanceToAdd.value.default_custom_field_option.elemID.getFullName(),
          )
          expect(instance.value.custom_field_options).toHaveLength(2)
          ;(instance.value.custom_field_options as Value[]).forEach((option, index) => {
            expect(option).toBeInstanceOf(ReferenceExpression)
            expect(option.elemID.getFullName()).toEqual(
              instanceToAdd.value.custom_field_options[index].elemID.getFullName(),
            )
          })
        })
    })
    it('should fetch user_field correctly', async () => {
      const instances = instancesToDeploy
      instances
        .filter(inst => inst.elemID.typeName === 'user_field')
        .forEach(instanceToAdd => {
          const instance = elements.find(e => e.elemID.isEqual(instanceToAdd.elemID)) as InstanceElement
          expect(instance).toBeDefined()
          expect(_.omit(instance.value, ['custom_field_options'])).toMatchObject(
            // We omit position since we add the user field to the order element
            _.omit(instanceToAdd.value, ['custom_field_options', 'position']),
          )
          expect(instance.value.custom_field_options).toHaveLength(2)
          ;(instance.value.custom_field_options as Value[]).forEach((option, index) => {
            expect(option).toBeInstanceOf(ReferenceExpression)
            expect(option.elemID.getFullName()).toEqual(
              instanceToAdd.value.custom_field_options[index].elemID.getFullName(),
            )
          })
          const userFieldsOrderInstance = elements
            .filter(e => e.elemID.typeName === 'user_field_order')
            .filter(isInstanceElement)
          expect(userFieldsOrderInstance).toHaveLength(1)
          const order = userFieldsOrderInstance[0]
          expect(order.value.active.map((ref: ReferenceExpression) => ref.elemID.getFullName())).toContain(
            instance.elemID.getFullName(),
          )
        })
    })
    it('should fetch Guide instances and types', async () => {
      const typesToFetch = Object.keys(GUIDE_SUPPORTED_TYPES)
      const typeNames = elements.filter(isObjectType).map(e => e.elemID.typeName)
      const instances = elements.filter(isInstanceElement)
      typesToFetch.forEach(typeName => {
        expect(typeNames).toContain(typeName)
        const instance = instances.find(e => e.elemID.typeName === typeName)
        expect(instance).toBeDefined()
      })
    })
    it('should handle guide elements correctly ', async () => {
      const fetchedElements = getElementsAfterFetch(guideInstances)
      guideInstances.forEach(elem => {
        verifyInstanceValues(fetchedElements[elem.elemID.getFullName()], elem, Object.keys(elem.value))
      })
    })
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('should handle guide theme elements correctly ', async () => {
      const fetchedElements = getElementsAfterFetch([guideThemeInstance])
      verifyInstanceValues(
        fetchedElements[guideThemeInstance.elemID.getFullName()],
        guideThemeInstance,
        Object.keys(guideThemeInstance.value),
      )
    })
  })
})
