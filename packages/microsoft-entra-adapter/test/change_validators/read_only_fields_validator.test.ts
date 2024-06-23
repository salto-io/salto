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

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import {
  ADAPTER_NAME,
  APPLICATION_TYPE_NAME,
  DIRECTORY_ROLE_TYPE_NAME,
  ROLE_DEFINITION_TYPE_NAME,
  SERVICE_PRINCIPAL_TYPE_NAME,
} from '../../src/constants'
import { readOnlyFieldsValidator } from '../../src/change_validators'

// Please notice that only a subset of the types are being tested here, since the logic is the same for all of them.
describe(`${readOnlyFieldsValidator.name}`, () => {
  const INSTANCE_NAME = 'test'
  describe(ROLE_DEFINITION_TYPE_NAME, () => {
    const roleDefinitionType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, ROLE_DEFINITION_TYPE_NAME),
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

  describe(SERVICE_PRINCIPAL_TYPE_NAME, () => {
    const servicePrincipalType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, SERVICE_PRINCIPAL_TYPE_NAME),
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

  describe(APPLICATION_TYPE_NAME, () => {
    const applicationType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, APPLICATION_TYPE_NAME),
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

  describe(DIRECTORY_ROLE_TYPE_NAME, () => {
    const directoryRoleType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, DIRECTORY_ROLE_TYPE_NAME),
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
})
