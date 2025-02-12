/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { e2eUtils, adapter } from '@salto-io/microsoft-security-adapter'
import { Workspace } from '@salto-io/workspace'
import { Element, InstanceElement, isInstanceElement, isObjectType, ObjectType } from '@salto-io/adapter-api'
import {
  e2eDeploy,
  fetchWorkspace,
  getElementsFromWorkspace,
  setupWorkspace,
  helpers as e2eHelpers,
} from '@salto-io/e2e-test-utils'
import { credsLease } from './adapter'
import { getAllInstancesToDeploy, UNIQUE_NAME } from './e2e_instance_generator'
import {
  getModificationDetailedChangesForCleanup,
  getModificationDetailedChangesFromInstances,
  microsoftSecurityCleanupChangeErrorFilter,
  microsoftSecurityCleanupValidationFilter,
  microsoftSecurityDeployChangeErrorFilter,
} from './helpers'
import { verifyInstanceValues } from './verificationUtils'
import { modificationChangesBeforeAndAfterOverrides } from './mock_elements'

const log = logger(module)
const {
  entraConstants: { TOP_LEVEL_TYPES: entraTopLevelTypes, ...entraConstants },
  intuneConstants: { TOP_LEVEL_TYPES: intuneTopLevelTypes },
} = e2eUtils

// Set long timeout as we communicate with Microsoft Graph APIs
jest.setTimeout(1000 * 60 * 15)

const adapterCreators = {
  microsoft_security: adapter,
}

const fetchDefinitions = e2eUtils.createFetchDefinitions({
  Entra: true,
  Intune: true,
})

const microsoftSecurityCleanUp = async (instances: InstanceElement[], workspace: Workspace): Promise<void> => {
  const instancesToClean = instances.filter(instance => instance.elemID.name.includes(UNIQUE_NAME))
  const typesToModify = Object.keys(modificationChangesBeforeAndAfterOverrides)
  const [instancesToModify, instancesToRemove] = _.partition(instancesToClean, instance =>
    typesToModify.includes(instance.elemID.typeName),
  )
  const detailedChangesToRemove = e2eHelpers.getDeletionDetailedChangesFromInstances(instancesToRemove)
  const detailedChangesToModify = getModificationDetailedChangesForCleanup(instancesToModify)
  const detailedChangesToClean = [...detailedChangesToRemove, ...detailedChangesToModify]
  if (detailedChangesToClean.length > 0) {
    await e2eDeploy({
      workspace,
      detailedChanges: detailedChangesToClean,
      adapterCreators,
      changeErrorFilter: microsoftSecurityCleanupChangeErrorFilter,
      validationFilter: microsoftSecurityCleanupValidationFilter,
    })
  }
}

const fetchBaseInstances = async (
  workspace: Workspace,
): Promise<{ types: ObjectType[]; firstFetchInstances: InstanceElement[] }> => {
  await fetchWorkspace({ workspace, adapterCreators })
  const elements = await getElementsFromWorkspace(workspace)
  const firstFetchInstances = elements.filter(isInstanceElement)
  const types = elements.filter(isObjectType)
  await microsoftSecurityCleanUp(firstFetchInstances, workspace)
  return { firstFetchInstances, types }
}

describe('Microsoft Security adapter E2E', () => {
  describe('fetch and deploy', () => {
    let credLease: CredsLease<e2eUtils.Credentials>
    let elements: Element[] = []
    let workspace: Workspace
    let instancesToAdd: InstanceElement[]
    let instancesToModify: InstanceElement[]

    afterAll(async () => {
      await microsoftSecurityCleanUp(elements.filter(isInstanceElement), workspace)
      if (credLease.return) {
        await credLease.return()
      }
      log.info('Microsoft Security adapter E2E: Log counts = %o', log.getLogCount())
    })

    // Needs to be after the afterAll because setupWorkspace has an afterAll of itself which closes the workspace
    const getWorkspace = setupWorkspace()

    beforeAll(async () => {
      log.resetLogCount()
      credLease = await credsLease()
      const { credentialsType } = adapter.authenticationMethods.basic
      workspace = await getWorkspace({
        envName: 'microsoft-security-env',
        adapterName: 'microsoft_security',
        credLease,
        configOverride: e2eUtils.DEFAULT_CONFIG,
        adapterCreators,
        credentialsType,
      })
      const { types, firstFetchInstances } = await fetchBaseInstances(workspace)
      ;({ instancesToAdd, instancesToModify } = await getAllInstancesToDeploy({
        types,
      }))

      const additionChanges = e2eHelpers.getAdditionDetailedChangesFromInstances(instancesToAdd)
      const modificationChanges = getModificationDetailedChangesFromInstances({
        firstFetchInstances,
        instancesToModify,
      })

      await e2eDeploy({
        workspace,
        detailedChanges: [...additionChanges, ...modificationChanges],
        adapterCreators,
        changeErrorFilter: microsoftSecurityDeployChangeErrorFilter,
      })
      await fetchWorkspace({ workspace, adapterCreators })
      elements = await getElementsFromWorkspace(workspace)
    })

    it('should fetch the regular instances and types', async () => {
      const typesToFetch = [
        // Entra ID
        entraTopLevelTypes.ADMINISTRATIVE_UNIT_TYPE_NAME,
        entraTopLevelTypes.APPLICATION_TYPE_NAME,
        entraTopLevelTypes.APP_ROLE_TYPE_NAME, // TODO SALTO-6454: test deployment
        entraConstants.AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
        entraTopLevelTypes.AUTHENTICATION_METHOD_POLICY_TYPE_NAME,
        entraTopLevelTypes.AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME,
        entraTopLevelTypes.CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
        entraConstants.CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME,
        entraTopLevelTypes.CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME,
        entraTopLevelTypes.CUSTOM_SECURITY_ATTRIBUTE_SET_TYPE_NAME,
        entraConstants.DELEGATED_PERMISSION_CLASSIFICATION_TYPE_NAME, // TODO SALTO-6454: test deployment
        entraTopLevelTypes.DIRECTORY_ROLE_TEMPLATE_TYPE_NAME, // Not deployable
        entraTopLevelTypes.DIRECTORY_ROLE_TYPE_NAME, // TODO SALTO-6454: test deployment
        entraTopLevelTypes.DOMAIN_TYPE_NAME, // TODO SALTO-6454: test deployment
        entraTopLevelTypes.GROUP_TYPE_NAME,
        entraTopLevelTypes.LIFE_CYCLE_POLICY_TYPE_NAME,
        entraTopLevelTypes.OAUTH2_PERMISSION_GRANT_TYPE_NAME, // TODO SALTO-6454: test deployment
        entraTopLevelTypes.PERMISSION_GRANT_POLICY_TYPE_NAME, // TODO SALTO-6454: test deployment
        entraTopLevelTypes.ROLE_DEFINITION_TYPE_NAME,
        entraTopLevelTypes.SERVICE_PRINCIPAL_TYPE_NAME,
        // Intune
        // TODO SALTO-6454: test Intune deployment
        intuneTopLevelTypes.APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME,
        intuneTopLevelTypes.APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME,
        intuneTopLevelTypes.APPLICATION_PROTECTION_ANDROID_TYPE_NAME,
        intuneTopLevelTypes.APPLICATION_PROTECTION_IOS_TYPE_NAME,
        intuneTopLevelTypes.APPLICATION_PROTECTION_WINDOWS_INFORMATION_PROTECTION_TYPE_NAME,
        intuneTopLevelTypes.APPLICATION_PROTECTION_WINDOWS_TYPE_NAME,
        intuneTopLevelTypes.APPLICATION_TYPE_NAME,
        intuneTopLevelTypes.DEVICE_COMPLIANCE_TYPE_NAME,
        intuneTopLevelTypes.DEVICE_CONFIGURATION_TYPE_NAME,
        intuneTopLevelTypes.FILTER_TYPE_NAME,
        intuneTopLevelTypes.PLATFORM_SCRIPT_LINUX_TYPE_NAME,
        intuneTopLevelTypes.PLATFORM_SCRIPT_MAC_OS_TYPE_NAME,
        intuneTopLevelTypes.PLATFORM_SCRIPT_WINDOWS_TYPE_NAME,
        intuneTopLevelTypes.SCOPE_TAG_TYPE_NAME,
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
      const instances = instancesToAdd
      const fetchedInstances = elements.filter(isInstanceElement)
      instances.forEach(instanceToAdd => {
        const fetchedInstance = fetchedInstances.find(e => e.elemID.isEqual(instanceToAdd.elemID))
        verifyInstanceValues({ fetchDefinitions, fetchedInstance, originalInstance: instanceToAdd })
      })
    })
  })
})
