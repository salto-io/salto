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

import {
  ObjectType,
  ElemID,
  InstanceElement,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import {
  OKTA,
  APP_USER_SCHEMA_TYPE_NAME,
  APPLICATION_TYPE_NAME,
  USER_SCHEMA_TYPE_NAME,
  GROUP_SCHEMA_TYPE_NAME,
} from '../../src/constants'
import { schemaBaseChangesValidator } from '../../src/change_validators/app_user_schema_base_properties'

describe('schemaBaseChangesValidator', () => {
  let appUserSchemaInstance: InstanceElement
  let userSchemaInstance: InstanceElement
  let groupSchemaInstance: InstanceElement

  const userSchemaType = new ObjectType({ elemID: new ElemID(OKTA, USER_SCHEMA_TYPE_NAME) })
  const groupSchemaType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_SCHEMA_TYPE_NAME) })
  const appUserSchemaType = new ObjectType({ elemID: new ElemID(OKTA, APP_USER_SCHEMA_TYPE_NAME) })
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })

  const app = new InstanceElement('app1', appType, {
    id: '1',
    label: 'app1',
    status: 'INACTIVE',
    accessPolicy: 'accessPolicyId',
  })
  beforeEach(() => {
    jest.clearAllMocks()
    appUserSchemaInstance = new InstanceElement(
      'appUserSchema1',
      appUserSchemaType,
      {
        definitions: {
          custom: {
            properties: {
              property1: {
                title: 'property1',
              },
            },
          },
          base: {
            properties: {
              property2: {
                title: 'property2',
              },
            },
          },
        },
      },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app.elemID, app, app)] },
    )
    userSchemaInstance = new InstanceElement('userSchema1', userSchemaType, {
      definitions: {
        custom: {
          properties: {
            property1: {
              title: 'property1',
            },
          },
        },
        base: {
          properties: {
            property2: {
              title: 'property2',
            },
          },
        },
      },
    })
    groupSchemaInstance = new InstanceElement('groupSchema1', groupSchemaType, {
      name: 'groupSchema1',
      title: 'groupSchema1 title',
      description: 'groupSchema1 description',
      definitions: {
        custom: {
          properties: {
            property1: {
              title: 'property1',
            },
          },
        },
        base: {
          properties: {
            property2: {
              title: 'property2',
            },
          },
        },
      },
    })
  })
  describe('addition changes', () => {
    it('should return info when adding a schema', async () => {
      const changes = [
        toChange({ after: appUserSchemaInstance }),
        toChange({ after: userSchemaInstance }),
        toChange({ after: groupSchemaInstance }),
      ]
      const changeErrors = await schemaBaseChangesValidator(changes)
      expect(changeErrors).toHaveLength(3)
      expect(changeErrors[0]).toEqual({
        elemID: appUserSchemaInstance.elemID,
        severity: 'Info',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated application.',
      })
      expect(changeErrors[1]).toEqual({
        elemID: userSchemaInstance.elemID,
        severity: 'Info',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated schema.',
      })
      expect(changeErrors[2]).toEqual({
        elemID: groupSchemaInstance.elemID,
        severity: 'Info',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated schema.',
      })
    })
  })
  describe('when only changing the base field', () => {
    it('should return error when trying to add property to base field', async () => {
      const appUserSchemaAfter = appUserSchemaInstance.clone()
      appUserSchemaAfter.value.definitions.base.properties.property3 = { title: 'property3' }

      const userSchemaAfter = userSchemaInstance.clone()
      userSchemaAfter.value.definitions.base.properties.property3 = { title: 'property3' }

      const groupSchemaAfter = groupSchemaInstance.clone()
      groupSchemaAfter.value.definitions.base.properties.property3 = { title: 'property3' }

      const changes = [
        toChange({ before: appUserSchemaInstance, after: appUserSchemaAfter }),
        toChange({ before: userSchemaInstance, after: userSchemaAfter }),
        toChange({ before: groupSchemaInstance, after: groupSchemaAfter }),
      ]
      const changeErrors = await schemaBaseChangesValidator(changes)
      expect(changeErrors).toHaveLength(3)
      expect(changeErrors[0]).toEqual({
        elemID: appUserSchemaInstance.elemID,
        severity: 'Error',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated application.',
      })
      expect(changeErrors[1]).toEqual({
        elemID: userSchemaInstance.elemID,
        severity: 'Error',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated schema.',
      })
      expect(changeErrors[2]).toEqual({
        elemID: groupSchemaInstance.elemID,
        severity: 'Error',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated schema.',
      })
    })
    it('should return error when trying to remove property from base field', async () => {
      const appUserSchemaAfter = appUserSchemaInstance.clone()
      delete appUserSchemaAfter.value.definitions.base.properties.property2

      const userSchemaAfter = userSchemaInstance.clone()
      delete userSchemaAfter.value.definitions.base.properties.property2

      const groupSchemaAfter = groupSchemaInstance.clone()
      delete groupSchemaAfter.value.definitions.base.properties.property2

      const changes = [
        toChange({ before: appUserSchemaInstance, after: appUserSchemaAfter }),
        toChange({ before: userSchemaInstance, after: userSchemaAfter }),
        toChange({ before: groupSchemaInstance, after: groupSchemaAfter }),
      ]
      const changeErrors = await schemaBaseChangesValidator(changes)
      expect(changeErrors).toHaveLength(3)
      expect(changeErrors[0]).toEqual({
        elemID: appUserSchemaInstance.elemID,
        severity: 'Error',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated application.',
      })
      expect(changeErrors[1]).toEqual({
        elemID: userSchemaInstance.elemID,
        severity: 'Error',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated schema.',
      })
      expect(changeErrors[2]).toEqual({
        elemID: groupSchemaInstance.elemID,
        severity: 'Error',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated schema.',
      })
    })
    it('should return error when trying to change property in base field', async () => {
      const appUserSchemaAfter = appUserSchemaInstance.clone()
      appUserSchemaAfter.value.definitions.base.properties.property2.title = 'changed title'

      const userSchemaAfter = userSchemaInstance.clone()
      userSchemaAfter.value.definitions.base.properties.property2.title = 'changed title'

      const groupSchemaAfter = groupSchemaInstance.clone()
      groupSchemaAfter.value.definitions.base.properties.property2.title = 'changed title'

      const changes = [
        toChange({ before: appUserSchemaInstance, after: appUserSchemaAfter }),
        toChange({ before: userSchemaInstance, after: userSchemaAfter }),
        toChange({ before: groupSchemaInstance, after: groupSchemaAfter }),
      ]
      const changeErrors = await schemaBaseChangesValidator(changes)
      expect(changeErrors).toHaveLength(3)
      expect(changeErrors[0]).toEqual({
        elemID: appUserSchemaInstance.elemID,
        severity: 'Error',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated application.',
      })
      expect(changeErrors[1]).toEqual({
        elemID: userSchemaInstance.elemID,
        severity: 'Error',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated schema.',
      })
      expect(changeErrors[2]).toEqual({
        elemID: groupSchemaInstance.elemID,
        severity: 'Error',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated schema.',
      })
    })
  })
  describe('when changing the custom field', () => {
    it('should return warning when trying to change the base field and the custom field', async () => {
      const appUserSchemaAfter = appUserSchemaInstance.clone()
      appUserSchemaAfter.value.definitions.base.properties.property2.title = 'changed title'
      appUserSchemaAfter.value.definitions.custom.properties.property1.title = 'changed title'

      const userSchemaAfter = userSchemaInstance.clone()
      userSchemaAfter.value.definitions.base.properties.property2.title = 'changed title'
      userSchemaAfter.value.definitions.custom.properties.property1.title = 'changed title'

      const groupSchemaAfter = groupSchemaInstance.clone()
      groupSchemaAfter.value.definitions.base.properties.property2.title = 'changed title'
      groupSchemaAfter.value.definitions.custom.properties.property1.title = 'changed title'

      const changes = [
        toChange({ before: appUserSchemaInstance, after: appUserSchemaAfter }),
        toChange({ before: userSchemaInstance, after: userSchemaAfter }),
        toChange({ before: groupSchemaInstance, after: groupSchemaAfter }),
      ]
      const changeErrors = await schemaBaseChangesValidator(changes)
      expect(changeErrors).toHaveLength(3)
      expect(changeErrors[0]).toEqual({
        elemID: appUserSchemaInstance.elemID,
        severity: 'Warning',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated application.',
      })
      expect(changeErrors[1]).toEqual({
        elemID: userSchemaInstance.elemID,
        severity: 'Warning',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated schema.',
      })
      expect(changeErrors[2]).toEqual({
        elemID: groupSchemaInstance.elemID,
        severity: 'Warning',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated schema.',
      })
    })
    it('should not return errors when trying to change only the custom field', async () => {
      const appUserSchemaAfter = appUserSchemaInstance.clone()
      appUserSchemaAfter.value.definitions.custom.properties.property1.title = 'changed title'

      const userSchemaAfter = userSchemaInstance.clone()
      userSchemaAfter.value.definitions.custom.properties.property1.title = 'changed title'

      const groupSchemaAfter = groupSchemaInstance.clone()
      groupSchemaAfter.value.definitions.custom.properties.property1.title = 'changed title'

      const changes = [
        toChange({ before: appUserSchemaInstance, after: appUserSchemaAfter }),
        toChange({ before: userSchemaInstance, after: userSchemaAfter }),
        toChange({ before: groupSchemaInstance, after: groupSchemaAfter }),
      ]
      const changeErrors = await schemaBaseChangesValidator(changes)
      expect(changeErrors).toHaveLength(0)
    })
    it('should handle undefined before base field', async () => {
      const appUserSchemaBefore = appUserSchemaInstance.clone()
      delete appUserSchemaBefore.value.definitions
      const changes = [toChange({ before: appUserSchemaBefore, after: appUserSchemaInstance })]
      const changeErrors = await schemaBaseChangesValidator(changes)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0]).toEqual({
        elemID: appUserSchemaInstance.elemID,
        severity: 'Warning',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated application.',
      })
    })
    it('should handle undefined after base field', async () => {
      const appUserSchemaAfter = appUserSchemaInstance.clone()
      delete appUserSchemaAfter.value.definitions
      const changes = [toChange({ before: appUserSchemaInstance, after: appUserSchemaAfter })]
      const changeErrors = await schemaBaseChangesValidator(changes)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0]).toEqual({
        elemID: appUserSchemaInstance.elemID,
        severity: 'Warning',
        message: "Base attributes cannot be deployed via Okta's APIs",
        detailedMessage:
          'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated application.',
      })
    })
  })
})
