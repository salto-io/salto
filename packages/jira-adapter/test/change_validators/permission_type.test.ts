/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, ElemID, ReadOnlyElementsSource, InstanceElement, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { permissionTypeValidator } from '../../src/change_validators/permission_type'
import { JIRA, PERMISSIONS, PERMISSION_SCHEME_TYPE_NAME } from '../../src/constants'

describe('permissionType change validator', () => {
  let elementsSource: ReadOnlyElementsSource
  let elements: InstanceElement[]
  const permissionObject = new ObjectType({ elemID: new ElemID(JIRA, PERMISSIONS) })
  const permissionsInstance = new InstanceElement('_config', permissionObject, {
    permissions: {
      validPermission: {
        key: 'validPermission',
      },
    },
  })
  const permissionSchemeObject = new ObjectType({ elemID: new ElemID(JIRA, PERMISSION_SCHEME_TYPE_NAME) })
  const invalidPermissionScheme = new InstanceElement('instance1', permissionSchemeObject, {
    permissions: [
      {
        permission: 'validPermission',
      },
      {
        permission: 'inValidPermission',
      },
    ],
  })
  const validPermissionScheme = new InstanceElement('instance2', permissionSchemeObject, {
    permissions: [
      {
        permission: 'validPermission',
      },
    ],
  })
  const noFieldPermissionScheme = new InstanceElement('instance2', permissionSchemeObject, {})

  beforeEach(() => {
    elements = [invalidPermissionScheme, permissionsInstance, validPermissionScheme]
    elementsSource = buildElementsSourceFromElements(elements)
  })

  it('should return an error for invalid permission scheme', async () => {
    expect(
      await permissionTypeValidator(
        [toChange({ after: invalidPermissionScheme }), toChange({ after: validPermissionScheme })],
        elementsSource,
      ),
    ).toEqual([
      {
        elemID: invalidPermissionScheme.elemID,
        severity: 'Warning',
        message: 'Invalid permission type in permission scheme',
        detailedMessage:
          'The permissions inValidPermission in jira.PermissionScheme.instance.instance1 do not exist in the current environment and will be excluded during deployment',
      },
    ])
  })
  it('should not return an error for valid permission scheme', async () => {
    expect(await permissionTypeValidator([toChange({ after: validPermissionScheme })], elementsSource)).toBeEmpty()
  })

  it('should return an empty list if no permission instance is found', async () => {
    elementsSource = buildElementsSourceFromElements([])
    expect(await permissionTypeValidator([toChange({ after: invalidPermissionScheme })], elementsSource)).toBeEmpty()
  })
  it('should not crash if there are no permissions field', async () => {
    elements = [noFieldPermissionScheme, permissionsInstance]
    elementsSource = buildElementsSourceFromElements(elements)
    expect(await permissionTypeValidator([toChange({ after: noFieldPermissionScheme })], elementsSource)).toBeEmpty()
  })
  it('should not return an error if there are no permission scheme changes', async () => {
    const otherInstance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID(JIRA, 'someType') }), {})
    expect(
      await permissionTypeValidator(
        [toChange({ after: otherInstance })],
        buildElementsSourceFromElements([otherInstance]),
      ),
    ).toBeEmpty()
  })
})
