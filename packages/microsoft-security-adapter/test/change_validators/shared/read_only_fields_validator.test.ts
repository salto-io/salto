/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { MICROSOFT_SECURITY, entraConstants } from '../../../src/constants'
import { readOnlyFieldsValidator } from '../../../src/change_validators/shared/read_only_fields_validator'

// Please notice that only a subset of the types are being tested here, since the logic is the same for all of them.
describe(`${readOnlyFieldsValidator.name}`, () => {
  const INSTANCE_NAME = 'test'
  describe(entraConstants.TOP_LEVEL_TYPES.ROLE_DEFINITION_TYPE_NAME, () => {
    const roleDefinitionType = new ObjectType({
      elemID: new ElemID(MICROSOFT_SECURITY, entraConstants.TOP_LEVEL_TYPES.ROLE_DEFINITION_TYPE_NAME),
    })
    it('should return change warning if there is a change in inheritsPermissionsFrom field', async () => {
      const roleDefinition = new InstanceElement(INSTANCE_NAME, roleDefinitionType, {
        inheritsPermissionsFrom: 'test',
      })
      const afterRoleDefinition = roleDefinition.clone()
      afterRoleDefinition.value.inheritsPermissionsFrom = 'test2'
      const changes = [
        toChange({
          before: roleDefinition.clone(),
          after: afterRoleDefinition.clone(),
        }),
      ]
      const res = await readOnlyFieldsValidator(changes)
      expect(res).toHaveLength(1)
      expect(res[0].detailedMessage).toEqual(
        'The following read-only fields were changed and cannot be deployed: inheritsPermissionsFrom. These changes will be ignored.',
      )
    })

    it('should not return change warning if inheritsPermissionsFrom field exists in the instance and this is an addition change', async () => {
      const roleDefinition = new InstanceElement(INSTANCE_NAME, roleDefinitionType, {
        inheritsPermissionsFrom: 'test',
      })
      const changes = [
        toChange({
          after: roleDefinition.clone(),
        }),
      ]
      const res = await readOnlyFieldsValidator(changes)
      expect(res).toHaveLength(0)
    })

    it('should not return change warning if there is no change in inheritsPermissionsFrom field', async () => {
      const roleDefinition = new InstanceElement('testRoleDefinition', roleDefinitionType, {
        inheritsPermissionsFrom: 'test',
      })
      const changes = [
        toChange({
          before: roleDefinition.clone(),
          after: roleDefinition.clone(),
        }),
      ]
      const res = await readOnlyFieldsValidator(changes)
      expect(res).toHaveLength(0)
    })
  })

  describe(entraConstants.TOP_LEVEL_TYPES.SERVICE_PRINCIPAL_TYPE_NAME, () => {
    const servicePrincipalType = new ObjectType({
      elemID: new ElemID(MICROSOFT_SECURITY, entraConstants.TOP_LEVEL_TYPES.SERVICE_PRINCIPAL_TYPE_NAME),
    })
    it('should return change warning if there is a change in readonly fields', async () => {
      const servicePrincipal = new InstanceElement('testServicePrincipal', servicePrincipalType, {
        appId: 'test',
      })
      const afterServicePrincipal = servicePrincipal.clone()
      afterServicePrincipal.value.appId = 'test2'
      afterServicePrincipal.value.displayName = 'testNew'
      const changes = [
        toChange({
          before: servicePrincipal.clone(),
          after: afterServicePrincipal,
        }),
      ]
      const res = await readOnlyFieldsValidator(changes)
      expect(res).toHaveLength(1)
      expect(res[0].detailedMessage).toEqual(
        'The following read-only fields were changed and cannot be deployed: appId, displayName. These changes will be ignored.',
      )
    })

    it('should not return change warning if there is no change in readonly fields', async () => {
      const servicePrincipal = new InstanceElement('testServicePrincipal', servicePrincipalType, {
        appId: 'test',
        displayName: 'test',
      })
      const changes = [
        toChange({
          before: servicePrincipal.clone(),
          after: servicePrincipal.clone(),
        }),
      ]
      const res = await readOnlyFieldsValidator(changes)
      expect(res).toHaveLength(0)
    })
  })

  describe(entraConstants.TOP_LEVEL_TYPES.APPLICATION_TYPE_NAME, () => {
    const applicationType = new ObjectType({
      elemID: new ElemID(MICROSOFT_SECURITY, entraConstants.TOP_LEVEL_TYPES.APPLICATION_TYPE_NAME),
    })
    it('should return change warning if there is a change in readonly fields', async () => {
      const application = new InstanceElement('testApplication', applicationType, {
        appId: 'test',
      })
      const afterApplication = application.clone()
      afterApplication.value.appId = 'test2'
      afterApplication.value.publisherDomain = 'testNew'
      const changes = [
        toChange({
          before: application.clone(),
          after: afterApplication,
        }),
      ]
      const res = await readOnlyFieldsValidator(changes)
      expect(res).toHaveLength(1)
      expect(res[0].detailedMessage).toEqual(
        'The following read-only fields were changed and cannot be deployed: appId, publisherDomain. These changes will be ignored.',
      )
    })

    it('should not return change warning if there is no change in appId field', async () => {
      const application = new InstanceElement('testApplication', applicationType, {
        appId: 'test',
        publisherDomain: 'test',
      })
      const changes = [
        toChange({
          before: application.clone(),
          after: application.clone(),
        }),
      ]
      const res = await readOnlyFieldsValidator(changes)
      expect(res).toHaveLength(0)
    })
  })

  describe(entraConstants.TOP_LEVEL_TYPES.DIRECTORY_ROLE_TYPE_NAME, () => {
    const directoryRoleType = new ObjectType({
      elemID: new ElemID(MICROSOFT_SECURITY, entraConstants.TOP_LEVEL_TYPES.DIRECTORY_ROLE_TYPE_NAME),
    })
    it('should return change warning if there is a change in readonly fields', async () => {
      const directoryRole = new InstanceElement('testDirectoryRole', directoryRoleType, {
        description: 'test',
      })
      const afterDirectoryRole = directoryRole.clone()
      afterDirectoryRole.value.description = 'test2'
      afterDirectoryRole.value.displayName = 'testNew'
      const changes = [
        toChange({
          before: directoryRole.clone(),
          after: afterDirectoryRole,
        }),
      ]
      const res = await readOnlyFieldsValidator(changes)
      expect(res).toHaveLength(1)
      expect(res[0].detailedMessage).toEqual(
        'The following read-only fields were changed and cannot be deployed: description, displayName. These changes will be ignored.',
      )
    })

    it('should not return change warning if there is no change in readonly fields', async () => {
      const directoryRole = new InstanceElement('testDirectoryRole', directoryRoleType, {
        description: 'test',
        displayName: 'test',
      })
      const changes = [
        toChange({
          before: directoryRole.clone(),
          after: directoryRole.clone(),
        }),
      ]
      const res = await readOnlyFieldsValidator(changes)
      expect(res).toHaveLength(0)
    })
  })

  describe(entraConstants.TOP_LEVEL_TYPES.GROUP_TYPE_NAME, () => {
    const groupType = new ObjectType({
      elemID: new ElemID(MICROSOFT_SECURITY, entraConstants.TOP_LEVEL_TYPES.GROUP_TYPE_NAME),
    })

    it('should return change warning if there is a change in readonly fields on modification', async () => {
      const group = new InstanceElement('testGroup', groupType, {
        mail: 'test',
      })
      const afterGroup = group.clone()
      afterGroup.value.mail = 'test2'
      afterGroup.value.assignedLicenses = 'testNew'
      const changes = [
        toChange({
          before: group.clone(),
          after: afterGroup,
        }),
      ]
      const res = await readOnlyFieldsValidator(changes)
      expect(res).toHaveLength(1)
      expect(res[0].detailedMessage).toEqual(
        'The following read-only fields were changed and cannot be deployed: mail, assignedLicenses. These changes will be ignored.',
      )
    })

    it('should return change warning if there readonly fields exist on addition', async () => {
      const group = new InstanceElement('testGroup', groupType, {
        mail: 'test',
        assignedLicenses: 'test',
      })
      const changes = [
        toChange({
          after: group.clone(),
        }),
      ]
      const res = await readOnlyFieldsValidator(changes)
      expect(res).toHaveLength(1)
      expect(res[0].detailedMessage).toEqual(
        'The following read-only fields were changed and cannot be deployed: mail, assignedLicenses. These changes will be ignored.',
      )
    })

    it('should not return change warning if there is no change in readonly fields', async () => {
      const group = new InstanceElement('testGroup', groupType, {
        mail: 'test',
        assignedLicenses: 'test',
      })
      const changes = [
        toChange({
          before: group.clone(),
          after: group.clone(),
        }),
      ]
      const res = await readOnlyFieldsValidator(changes)
      expect(res).toHaveLength(0)
    })
  })
})
