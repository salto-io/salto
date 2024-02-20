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
import { getParent } from '@salto-io/adapter-utils'
import { OKTA, APP_USER_SCHEMA_TYPE_NAME, APPLICATION_TYPE_NAME, INACTIVE_STATUS } from '../../src/constants'
import { appUserSchemaWithInactiveAppValidator } from '../../src/change_validators/app_schema_with_inactive_app'

describe('appSchemaWithInActiveAppValidator', () => {
  const appSchemaType = new ObjectType({ elemID: new ElemID(OKTA, APP_USER_SCHEMA_TYPE_NAME) })
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const app1 = new InstanceElement('app1', appType, {
    id: '1',
    label: 'app1',
    status: 'INACTIVE',
    accessPolicy: 'accessPolicyId',
  })
  const appUserSchema1 = new InstanceElement(
    'appUserSchema1',
    appSchemaType,
    {
      definitions: {
        custom: {
          properties: {
            property1: {},
          },
        },
      },
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app1.elemID, app1)] },
  )
  it('should return error when app stayed inactive and did not change at all ', async () => {
    const appUserSchema1After = appUserSchema1.clone()
    appUserSchema1After.value.definitions.custom.properties.property2 = {}
    const changes = [toChange({ before: appUserSchema1, after: appUserSchema1After })]
    const changeErrors = await appUserSchemaWithInactiveAppValidator(changes)
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors).toEqual([
      {
        elemID: appUserSchema1.elemID,
        severity: 'Error',
        message: `Cannot modify App User schema when its associated app is ${INACTIVE_STATUS}`,
        detailedMessage: `Cannot modify App User schema '${appUserSchema1.elemID.name}' because its associated app '${getParent(appUserSchema1).elemID.name}' is inactive. Please activate the app in order to modify this element.`,
      },
    ])
  })
  it('should return error when app stayed inactive but changed somewhere else', async () => {
    const appUserSchema1After = appUserSchema1.clone()
    appUserSchema1After.value.definitions.custom.properties.property2 = {}
    const app1After = app1.clone()
    app1After.value.accessPolicy = 'changedAccessPolicyId'
    const changes = [
      toChange({ before: appUserSchema1, after: appUserSchema1After }),
      toChange({ before: app1, after: app1After }),
    ]
    const changeErrors = await appUserSchemaWithInactiveAppValidator(changes)
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors).toEqual([
      {
        elemID: appUserSchema1.elemID,
        severity: 'Error',
        message: `Cannot modify App User schema when its associated app is ${INACTIVE_STATUS}`,
        detailedMessage: `Cannot modify App User schema '${appUserSchema1.elemID.name}' because its associated app '${getParent(appUserSchema1).elemID.name}' is inactive. Please activate the app in order to modify this element.`,
      },
    ])
  })
  it('should not return error when app becomes active after modification', async () => {
    const appUserSchema1After = appUserSchema1.clone()
    appUserSchema1After.value.definitions.custom.properties.property2 = {}
    const app1After = app1.clone()
    app1After.value.status = 'ACTIVE'
    const changes = [
      toChange({ before: appUserSchema1, after: appUserSchema1After }),
      toChange({ before: app1, after: app1After }),
    ]
    const changeErrors = await appUserSchemaWithInactiveAppValidator(changes)
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error when app becomes inactive after modification', async () => {
    const app2 = app1.clone()
    app2.value.status = 'ACTIVE'
    const app2After = app2.clone()
    app2After.value.status = 'INACTIVE'
    const appUserSchema1After = appUserSchema1.clone()
    appUserSchema1After.value.definitions.custom.properties.property2 = {}
    const changes = [
      toChange({ before: appUserSchema1, after: appUserSchema1After }),
      toChange({ before: app2, after: app2After }),
    ]
    const changeErrors = await appUserSchemaWithInactiveAppValidator(changes)
    expect(changeErrors).toHaveLength(0)
  })
})
