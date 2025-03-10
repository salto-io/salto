/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  BuiltinTypes,
  Change,
  ElemID,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import changeValidator, { TYPES_EMAILS } from '../../src/change_validators/access_to_send_email'
import { SALESFORCE } from '../../src/constants'

const createEmailElementsChanges = (): Change[] => {
  const elements: InstanceElement[] = []
  TYPES_EMAILS.forEach(type =>
    elements.push(new InstanceElement(type, new ObjectType({ elemID: new ElemID(SALESFORCE, type) }))),
  )
  return elements.map(element => toChange({ after: element }))
}
describe('access to send email CV', () => {
  let userObject: ObjectType
  let elementsSource: ReadOnlyElementsSource
  describe("when 'Access to Send Email (All Email Services)' is set to 'All email'", () => {
    beforeEach(() => {
      userObject = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'User'),
        fields: {
          UserPreferencesNativeEmailClient: { refType: BuiltinTypes.STRING },
          someOtherField: { refType: BuiltinTypes.STRING },
        },
      })
      elementsSource = buildElementsSourceFromElements([userObject])
    })
    it('should return no errors', async () => {
      const errors = await changeValidator(createEmailElementsChanges(), elementsSource)
      expect(errors).toHaveLength(TYPES_EMAILS.length)
    })
  })
  describe("when 'Access to Send Email (All Email Services)' is set to 'No access' or 'System email only'", () => {
    beforeEach(() => {
      userObject = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'User'),
        fields: { someOtherField: { refType: BuiltinTypes.STRING } },
      })
      elementsSource = buildElementsSourceFromElements([userObject])
    })
    it('should return an error', async () => {})
  })
})
