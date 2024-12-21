/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  toChange,
  ObjectType,
  ElemID,
  InstanceElement,
  ReferenceExpression,
  CORE_ANNOTATIONS,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import {
  OKTA,
  APPLICATION_TYPE_NAME,
  APP_GROUP_ASSIGNMENT_TYPE_NAME,
  APP_USER_SCHEMA_TYPE_NAME,
} from '../../src/constants'
import { appGroupAssignmentProfileAttributesValidator } from '../../src/change_validators/app_group_assignments_profile_attributes'

describe('appGroupAssignmentProfileAttributesValidator', () => {
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const app1 = new InstanceElement('app1', appType, {
    id: '1',
    label: 'app1',
    status: 'INACTIVE',
  })
  const appUserSchemaType = new ObjectType({ elemID: new ElemID(OKTA, APP_USER_SCHEMA_TYPE_NAME) })
  const appUserSchema1 = new InstanceElement(
    'app1',
    appUserSchemaType,
    {
      definitions: {
        custom: {
          properties: {
            a: {
              title: 'A',
              type: 'string',
              externalName: 'a',
              scope: 'NONE',
              master: {
                type: 'PROFILE_MASTER',
              },
            },
          },
        },
      },
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app1.elemID, app1)],
      [CORE_ANNOTATIONS.ALIAS]: 'app1UserSchema_alias',
    },
  )
  const appGroupType = new ObjectType({ elemID: new ElemID(OKTA, APP_GROUP_ASSIGNMENT_TYPE_NAME) })
  let appGroupInst: InstanceElement
  let elementSource: ReadOnlyElementsSource

  beforeEach(() => {
    elementSource = buildElementsSourceFromElements([appUserSchema1])
  })
  describe('when appGroupAssignment has missing profile attributes in its compatible appUserSchema', () => {
    beforeEach(() => {
      appGroupInst = new InstanceElement(
        'appGroup1',
        appGroupType,
        {
          id: 'ab',
          priority: 0,
          profile: {
            b: 'hello b',
            c: 'hello c',
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app1.elemID, app1)],
        },
      )
    })
    it('should return error', async () => {
      expect(
        await appGroupAssignmentProfileAttributesValidator([toChange({ after: appGroupInst })], elementSource),
      ).toEqual([
        {
          elemID: appGroupInst.elemID,
          severity: 'Error',
          message: 'This element contains properties that are not defined in the application schema.',
          detailedMessage:
            'The following profile attributes are not defined in the related application schema: [b,c]. Please add these attributes to the Application User Schema app1UserSchema_alias or remove them from this group assignment.',
        },
      ])
    })
  })
  describe("when appGroupAssignment doesn't have missing profile attributes in its compatible appUserSchema", () => {
    beforeEach(() => {
      appGroupInst = new InstanceElement(
        'appGroup1',
        appGroupType,
        {
          id: 'ab',
          priority: 0,
          profile: {
            a: 'hello a',
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app1.elemID, app1)],
        },
      )
    })
    it('should not return error', async () => {
      expect(
        await appGroupAssignmentProfileAttributesValidator([toChange({ after: appGroupInst })], elementSource),
      ).toEqual([])
    })
  })
  describe('when appUserSchema is not found', () => {
    beforeEach(() => {
      appGroupInst = new InstanceElement(
        'appGroup1',
        appGroupType,
        {
          id: 'ab',
          priority: 0,
          profile: {
            a: 'hello a',
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app1.elemID, app1)],
        },
      )
      elementSource = buildElementsSourceFromElements([])
    })
    it('should not return error', async () => {
      expect(
        await appGroupAssignmentProfileAttributesValidator([toChange({ after: appGroupInst })], elementSource),
      ).toEqual([])
    })
  })
})
