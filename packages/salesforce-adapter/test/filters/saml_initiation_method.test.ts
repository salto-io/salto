/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ObjectType,
  InstanceElement,
  Element,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  createRestriction,
  ElemID,
} from '@salto-io/adapter-api'
import filterCreator, { SAML_INIT_METHOD_FIELD_NAME } from '../../src/filters/saml_initiation_method'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'
import { CANVAS_METADATA_TYPE, METADATA_TYPE, SALESFORCE } from '../../src/constants'

describe('saml initiation method filter', () => {
  const mockType = new ObjectType({
    elemID: new ElemID(SALESFORCE, CANVAS_METADATA_TYPE),
    annotations: {
      [METADATA_TYPE]: CANVAS_METADATA_TYPE,
    },
    fields: {
      [SAML_INIT_METHOD_FIELD_NAME]: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
            values: ['None', 'IdpInitiated', 'SpInitiated'],
          }),
        },
      },
    },
  })

  const mockInstance = new InstanceElement('fake', mockType, {
    [SAML_INIT_METHOD_FIELD_NAME]: '0',
  })

  let testElements: Element[]

  const filter = filterCreator({
    config: defaultFilterContext,
  }) as FilterWith<'onFetch'>

  beforeEach(() => {
    testElements = [_.clone(mockType), _.clone(mockInstance)]
  })

  describe('on fetch', () => {
    it('should transform illegal val to None', async () => {
      await filter.onFetch(testElements)
      expect((testElements[1] as InstanceElement).value[SAML_INIT_METHOD_FIELD_NAME]).toEqual('None')
    })

    it('should keep legal val to', async () => {
      ;(testElements[1] as InstanceElement).value[SAML_INIT_METHOD_FIELD_NAME] = 'IdpInitiated'
      await filter.onFetch(testElements)
      expect((testElements[1] as InstanceElement).value[SAML_INIT_METHOD_FIELD_NAME]).toEqual('IdpInitiated')
    })
  })
})
