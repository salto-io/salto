/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import {
  OKTA,
  APP_GROUP_ASSIGNMENT_TYPE_NAME,
  APPLICATION_TYPE_NAME,
  APP_USER_SCHEMA_TYPE_NAME,
} from '../../src/constants'
import { groupAssignmentToAppUserSchemaHandler } from '../../src/weak_references/app_group_assignment_to_app_schema'

describe('groupAssignmentToAppUserSchemaHandler', () => {
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
    },
  )
  const appGroupType = new ObjectType({ elemID: new ElemID(OKTA, APP_GROUP_ASSIGNMENT_TYPE_NAME) })
  let appGroupInst: InstanceElement

  beforeEach(() => {
    appGroupInst = new InstanceElement(
      'appGroup1',
      appGroupType,
      {
        id: 'ab',
        priority: 0,
        profile: {
          a: 'hello',
        },
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app1.elemID, app1)],
      },
    )
  })
  describe('findWeakReferences', () => {
    it('should return strong references', async () => {
      const references = await groupAssignmentToAppUserSchemaHandler.findWeakReferences([appGroupInst])

      expect(references).toEqual([
        {
          source: appGroupInst.elemID,
          target: appUserSchema1.elemID.createNestedID('definitions', 'custom', 'properties', 'a'),
          type: 'strong',
          sourceScope: 'value',
        },
      ])
    })
    it('should do nothing if received invalid appGroupInst', async () => {
      appGroupInst.value.profile = 'invalid'
      const references = await groupAssignmentToAppUserSchemaHandler.findWeakReferences([appGroupInst])

      expect(references).toEqual([])
    })

    it('should do nothing if there is no profile', async () => {
      delete appGroupInst.value.profile
      const references = await groupAssignmentToAppUserSchemaHandler.findWeakReferences([appGroupInst])

      expect(references).toEqual([])
    })
  })
})
