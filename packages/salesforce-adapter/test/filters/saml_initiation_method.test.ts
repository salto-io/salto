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
import _ from 'lodash'
import {
  ObjectType,
  InstanceElement,
  Element,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  createRestriction,
} from '@salto-io/adapter-api'
import filterCreator, {
  CANVAS_METADATA_TYPE_ID,
  SAML_INIT_METHOD_FIELD_NAME,
} from '../../src/filters/saml_initiation_method'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

describe('saml initiation method filter', () => {
  const mockType = new ObjectType({
    elemID: CANVAS_METADATA_TYPE_ID,
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
      expect(
        (testElements[1] as InstanceElement).value[SAML_INIT_METHOD_FIELD_NAME],
      ).toEqual('None')
    })

    it('should keep legal val to', async () => {
      ;(testElements[1] as InstanceElement).value[SAML_INIT_METHOD_FIELD_NAME] =
        'IdpInitiated'
      await filter.onFetch(testElements)
      expect(
        (testElements[1] as InstanceElement).value[SAML_INIT_METHOD_FIELD_NAME],
      ).toEqual('IdpInitiated')
    })
  })
})
