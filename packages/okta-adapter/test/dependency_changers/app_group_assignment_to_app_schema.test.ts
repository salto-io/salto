/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ObjectType,
  ElemID,
  InstanceElement,
  toChange,
  DependencyChange,
  CORE_ANNOTATIONS,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import {
  OKTA,
  APPLICATION_TYPE_NAME,
  APP_GROUP_ASSIGNMENT_TYPE_NAME,
  APP_USER_SCHEMA_TYPE_NAME,
} from '../../src/constants'
import { addAppGroupToAppUserSchemaDependency } from '../../src/dependency_changers/app_group_assignment_to_app_schema'

describe('addAppGroupToAppUserSchemaDependency', () => {
  let dependencyChanges: DependencyChange[]
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const app1 = new InstanceElement('app1', appType, {
    id: '1',
    label: 'app1',
    status: 'INACTIVE',
  })
  const app2 = new InstanceElement('app2', appType, {
    id: '2',
    label: 'app2',
    status: 'ACTIVE',
  })
  const appUserSchemaType = new ObjectType({ elemID: new ElemID(OKTA, APP_USER_SCHEMA_TYPE_NAME) })
  const appUserSchema1 = new InstanceElement(
    'appUserSchema',
    appUserSchemaType,
    {
      name: 'A',
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app1.elemID, app1)],
    },
  )
  const appUserSchema2 = new InstanceElement(
    'appUserSchema',
    appUserSchemaType,
    {
      name: 'B',
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app2.elemID, app2)],
    },
  )
  const appGroupType = new ObjectType({ elemID: new ElemID(OKTA, APP_GROUP_ASSIGNMENT_TYPE_NAME) })
  const appGroupInst = new InstanceElement('appGroup1', appGroupType, { id: 'ab', priority: 0 }, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app1.elemID, app1)],
  })
  it('should add dependency from addition ApplicationGroupAssignment change to AppUserSchema change', async () => {
    const inputChanges = new Map([
      ['appGroup', toChange({ after: appGroupInst })],
      ['appUserSchema1', toChange({ before: appUserSchema1, after: appUserSchema1 })],
      ['appUserSchema2', toChange({ before: appUserSchema2, after: appUserSchema2 })],
    ])
    dependencyChanges = [...(await addAppGroupToAppUserSchemaDependency(inputChanges, new Map()))]
    expect(dependencyChanges).toHaveLength(1)
    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual('appGroup')
    expect(dependencyChanges[0].dependency.target).toEqual('appUserSchema1')
  })
  it('should add dependency from modification ApplicationGroupAssignment change to AppUserSchema change', async () => {
    const inputChanges = new Map([
      ['appGroup', toChange({ before: appGroupInst, after: appGroupInst })],
      ['appUserSchema1', toChange({ before: appUserSchema1, after: appUserSchema1 })],
      ['appUserSchema2', toChange({ before: appUserSchema2, after: appUserSchema2 })],
    ])
    dependencyChanges = [...(await addAppGroupToAppUserSchemaDependency(inputChanges, new Map()))]
    expect(dependencyChanges).toHaveLength(1)
    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual('appGroup')
    expect(dependencyChanges[0].dependency.target).toEqual('appUserSchema1')
  })
  it('should not add dependency from ApplicationGroupAssignment when change has no parent', async () => {
    const appGroupWithoutParent = new InstanceElement('appGroup1', appGroupType, { id: 'ab', priority: 0 }, undefined)
    const inputChanges = new Map([
      ['appGroupWithoutParent', toChange({ before: appGroupWithoutParent, after: appGroupWithoutParent })],
      ['appUserSchema1', toChange({ before: appUserSchema1, after: appUserSchema1 })],
      ['appUserSchema2', toChange({ before: appUserSchema2, after: appUserSchema2 })],
    ])
    dependencyChanges = [...(await addAppGroupToAppUserSchemaDependency(inputChanges, new Map()))]
    expect(dependencyChanges).toHaveLength(0)
  })
})
