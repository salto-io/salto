/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ListType,
  ModificationChange,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { isInactiveCustomAppChange } from '../../../../src/definitions/deploy/types/application'
import { APPLICATION_TYPE_NAME, OKTA } from '../../../../src/constants'

describe('application', () => {
  const appType = new ObjectType({
    elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME),
    fields: {
      id: { refType: BuiltinTypes.SERVICE_ID },
      features: { refType: new ListType(BuiltinTypes.STRING) },
    },
  })

  describe('isInactiveCustomAppChange', () => {
    const customApp = new InstanceElement('custom', appType, { customName: 'a', id: 'aa', status: 'INACTIVE' })
    it('should return true for custom app change in status INACTIVE', () => {
      const change = toChange({ before: customApp, after: customApp }) as ModificationChange<InstanceElement>
      expect(isInactiveCustomAppChange(change)).toEqual(true)
    })

    it('should return false for regular app change in status INACTIVE', () => {
      const app = customApp.clone()
      delete app.value.customName
      const change = toChange({ before: app, after: app }) as ModificationChange<InstanceElement>
      expect(isInactiveCustomAppChange(change)).toEqual(false)
    })

    it('should return false for custom app change with change in status', () => {
      const activeApp = customApp.clone()
      activeApp.value.status = 'ACTIVE'
      const change = toChange({ before: customApp, after: activeApp }) as ModificationChange<InstanceElement>
      expect(isInactiveCustomAppChange(change)).toEqual(false)
    })
  })
})
