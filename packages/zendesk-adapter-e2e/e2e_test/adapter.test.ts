/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { logger } from '@salto-io/logging'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { e2eUtils, adapter } from '@salto-io/zendesk-adapter'
import { ValidationError, Workspace } from '@salto-io/workspace'
import {
  ChangeError,
  DetailedChangeWithBaseChange,
  Element,
  ElemID,
  InstanceElement,
  isInstanceElement,
  isObjectType,
  ObjectType,
  ReferenceExpression,
  toChange,
  Value,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { e2eDeploy, fetchWorkspace, getElementsFromWorkspace, setupWorkspace } from '@salto-io/e2e-test-utils'
import { getDetailedChanges } from '@salto-io/adapter-utils'
import { credsLease } from './adapter'
import {
  getAllInstancesToDeploy,
  HELP_CENTER_BRAND_NAME,
  HIDDEN_PER_TYPE,
  TYPES_NOT_TO_REMOVE,
  UNIQUE_NAME,
} from './e2e_instance_generator'
import { verifyCustomObject, verifyInstanceValues } from './verificationUtils'

const log = logger(module)
const {
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_NAME,
  GROUP_TYPE_NAME,
  GUIDE_SUPPORTED_TYPES,
  GUIDE_THEME_TYPE_NAME,
  GUIDE_TYPES_TO_HANDLE_BY_BRAND,
  SUPPORT_ADDRESS_TYPE_NAME,
  THEME_SETTINGS_TYPE_NAME,
  ZENDESK,
} = e2eUtils

// Set long timeout as we communicate with Zendesk APIs
jest.setTimeout(1000 * 60 * 15)

const FETCH_CONFIG_OVERRIDE = {
  fetch: {
    guide: {
      brands: ['.*'],
      themes: {
        brands: ['.*'],
        referenceOptions: {
          enableReferenceLookup: false,
        },
      },
    },
    useGuideNewInfra: true,
    exclude: [],
  },
}

const adapterCreators = {
  zendesk: adapter,
}

const getAdditionDetailedChangesFromInstances = (instances: InstanceElement[]): DetailedChangeWithBaseChange[] => {
  const changes = instances.map(inst => toChange({ after: inst }))
  return changes.flatMap(change => getDetailedChanges(change))
}

const getDeletionDetailedChangesFromInstances = (instances: InstanceElement[]): DetailedChangeWithBaseChange[] => {
  const changes = instances.map(inst => toChange({ before: inst }))
  return changes.flatMap(change => getDetailedChanges(change))
}

// we cannot remove support address as it is the default, therefore when we remove the brand the support address gets validation error
const zendeskChangeErrorFilter = (error: ChangeError): boolean =>
  error.severity === 'Error' && !(error.elemID.typeName === SUPPORT_ADDRESS_TYPE_NAME)

// we remove elements and we don't modify the order that point at them
// we cannot remove support address as it is the default, therefore when we remove the brand the support address gets validation error
const zendeskValidationFilter = (error: ValidationError): boolean =>
  !(error.elemID.typeName.includes('order') || error.elemID.typeName === SUPPORT_ADDRESS_TYPE_NAME)

const zendeskCleanUp = async (instances: InstanceElement[], workspace: Workspace): Promise<void> => {
  const instancesToClean = instances
    .filter(instance => !TYPES_NOT_TO_REMOVE.has(instance.elemID.typeName))
    .filter(instance => instance.elemID.name.includes(UNIQUE_NAME))
  const detailedChangesToClean = getDeletionDetailedChangesFromInstances(instancesToClean)
  if (detailedChangesToClean.length > 0) {
    await e2eDeploy({
      workspace,
      detailedChanges: detailedChangesToClean,
      validationFilter: zendeskValidationFilter,
      adapterCreators,
      changeErrorFilter: zendeskChangeErrorFilter,
    })
  }
}

const filterHiddenFields = (instances: InstanceElement[]): InstanceElement[] =>
  instances
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

const fetchBaseInstances = async (
  workspace: Workspace,
): Promise<{
  brandInstanceE2eHelpCenter?: InstanceElement
  defaultGroup?: InstanceElement
  types?: ObjectType[]
}> => {
  await fetchWorkspace({ workspace, validationFilter: zendeskValidationFilter, adapterCreators })
  const elements = await getElementsFromWorkspace(workspace)
  const firstFetchInstances = elements.filter(isInstanceElement)
  const types = elements.filter(isObjectType)
  const brandInstanceE2eHelpCenter = firstFetchInstances.find(e => e.elemID.name === HELP_CENTER_BRAND_NAME)
  const defaultGroup = firstFetchInstances.find(e => e.elemID.typeName === GROUP_TYPE_NAME && e.value.default === true)
  expect(defaultGroup).toBeDefined()
  expect(brandInstanceE2eHelpCenter).toBeDefined()
  expect(brandInstanceE2eHelpCenter == null || defaultGroup == null).toBeFalsy()
  // we don't want to run zendesk clean up
  if (brandInstanceE2eHelpCenter == null || defaultGroup === null) {
    return {}
  }
  await zendeskCleanUp(firstFetchInstances, workspace)
  return { brandInstanceE2eHelpCenter, defaultGroup, types }
}

describe('Zendesk adapter E2E', () => {
  describe('fetch and deploy', () => {
    let credLease: CredsLease<e2eUtils.Credentials>
    let elements: Element[] = []
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

    afterAll(async () => {
      await zendeskCleanUp(elements.filter(isInstanceElement), workspace)
      if (credLease.return) {
        await credLease.return()
      }
      log.info('Zendesk adapter E2E: Log counts = %o', log.getLogCount())
    })

    // need to be after the afterAll because setupWorkspace has an afterAll of itself which closes the workspace
    const getWorkspace = setupWorkspace()

    beforeAll(async () => {
      log.resetLogCount()
      credLease = await credsLease()
      const { credentialsType } = adapter.authenticationMethods.basic
      workspace = await getWorkspace({
        envName: 'zendesk-env',
        adapterName: 'zendesk',
        credLease,
        configOverride: FETCH_CONFIG_OVERRIDE,
        adapterCreators,
        credentialsType,
      })
      const { brandInstanceE2eHelpCenter, defaultGroup, types } = await fetchBaseInstances(workspace)
      if (brandInstanceE2eHelpCenter == null || defaultGroup == null || types == null) {
        return
      }

      ;({ instancesToDeploy, guideInstances, guideThemeInstance } = await getAllInstancesToDeploy({
        brandInstanceE2eHelpCenter,
        defaultGroup,
        types,
      }))

      // we remove hidden fields as they cannot be deployed
      const noHiddenInstancesToDeploy = filterHiddenFields(instancesToDeploy)
      const detailedChanges = getAdditionDetailedChangesFromInstances(noHiddenInstancesToDeploy)
      await e2eDeploy({
        workspace,
        detailedChanges,
        validationFilter: zendeskValidationFilter,
        adapterCreators,
        changeErrorFilter: zendeskChangeErrorFilter,
      })
      await fetchWorkspace({ workspace, validationFilter: zendeskValidationFilter, adapterCreators })
      elements = await getElementsFromWorkspace(workspace)
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
          expect(instance == null).toBeFalsy()
          if (instance == null) {
            return
          }
          // custom object types have circular references (value and parent)
          // toMatchObject does not work well with circular references and crashes
          if ([CUSTOM_OBJECT_TYPE_NAME, CUSTOM_OBJECT_FIELD_TYPE_NAME].includes(instanceToAdd.elemID.typeName)) {
            verifyCustomObject(instance, instanceToAdd)
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
