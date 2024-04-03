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
  ElemID,
  Element,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { buildDataManagement } from '../../../src/fetch_profile/data_management'
import { SaltoIDSettings, DataManagementConfig } from '../../../src/types'
import {
  SALESFORCE,
  API_NAME,
  METADATA_TYPE,
  CUSTOM_OBJECT,
  CPQ_TESTED_OBJECT,
  FIELD_ANNOTATIONS,
} from '../../../src/constants'
import { Types } from '../../../src/transformers/transformer'
import filterCreator from '../../../src/filters/cpq/hide_read_only_values'
import { defaultFilterContext } from '../../utils'
import { FilterWith } from '../mocks'

describe('hide read only values filter', () => {
  type FilterType = FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
  let filter: FilterType
  let elements: Element[]

  const mockCustomElementID = new ElemID(SALESFORCE, CPQ_TESTED_OBJECT)
  const mockNotCustomObject = new ObjectType({
    elemID: mockCustomElementID,
    fields: {
      readOnlyField: {
        refType: Types.primitiveDataTypes.Text,
        annotations: {
          [FIELD_ANNOTATIONS.CREATABLE]: false,
          [FIELD_ANNOTATIONS.UPDATEABLE]: false,
        },
      },
      nonCreateableField: {
        refType: Types.primitiveDataTypes.Text,
        annotations: {
          [FIELD_ANNOTATIONS.CREATABLE]: false,
          [FIELD_ANNOTATIONS.UPDATEABLE]: true,
        },
      },
      nonUpdateableField: {
        refType: Types.primitiveDataTypes.Text,
        annotations: {
          [FIELD_ANNOTATIONS.CREATABLE]: true,
          [FIELD_ANNOTATIONS.UPDATEABLE]: false,
        },
      },
    },
  })
  const mockCustomObject = new ObjectType({
    elemID: mockCustomElementID,
    fields: {
      readOnlyField: {
        refType: Types.primitiveDataTypes.Text,
        annotations: {
          [FIELD_ANNOTATIONS.CREATABLE]: false,
          [FIELD_ANNOTATIONS.UPDATEABLE]: false,
        },
      },
      nonCreateableField: {
        refType: Types.primitiveDataTypes.Text,
        annotations: {
          [FIELD_ANNOTATIONS.CREATABLE]: false,
          [FIELD_ANNOTATIONS.UPDATEABLE]: true,
        },
      },
      nonUpdateableField: {
        refType: Types.primitiveDataTypes.Text,
        annotations: {
          [FIELD_ANNOTATIONS.CREATABLE]: true,
          [FIELD_ANNOTATIONS.UPDATEABLE]: false,
        },
      },
    },
    annotations: {
      [API_NAME]: CPQ_TESTED_OBJECT,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })

  describe('onFetch', () => {
    beforeEach(async () => {
      elements = [mockCustomObject.clone(), mockNotCustomObject.clone()]
    })
    it('Should do nothing for not custom object type', async () => {
      const config = defaultFilterContext
      filter = filterCreator({ config }) as FilterType
      await filter.onFetch(elements)
      const notCustomObjAfterFilter = elements[1] as ObjectType
      expect(notCustomObjAfterFilter).toBeDefined()
      expect(
        notCustomObjAfterFilter.fields.readOnlyField.annotations[
          CORE_ANNOTATIONS.HIDDEN_VALUE
        ],
      ).toBeUndefined()
      expect(
        notCustomObjAfterFilter.fields.nonCreateableField.annotations[
          CORE_ANNOTATIONS.HIDDEN_VALUE
        ],
      ).toBeUndefined()
      expect(
        notCustomObjAfterFilter.fields.nonUpdateableField.annotations[
          CORE_ANNOTATIONS.HIDDEN_VALUE
        ],
      ).toBeUndefined()
    })
    it('Should add "_hidden_value = true" to read only fields on custom object when showReadOnlyValue flag is undefined', async () => {
      const config = defaultFilterContext
      filter = filterCreator({ config }) as FilterType
      await filter.onFetch(elements)
      const customObjAfterFilter = elements[0] as ObjectType
      expect(customObjAfterFilter).toBeDefined()
      expect(
        customObjAfterFilter.fields.readOnlyField.annotations[
          CORE_ANNOTATIONS.HIDDEN_VALUE
        ],
      ).toBeTruthy()
      expect(
        customObjAfterFilter.fields.nonCreateableField.annotations[
          CORE_ANNOTATIONS.HIDDEN_VALUE
        ],
      ).toBeUndefined()
      expect(
        customObjAfterFilter.fields.nonUpdateableField.annotations[
          CORE_ANNOTATIONS.HIDDEN_VALUE
        ],
      ).toBeUndefined()
    })
    it('Should add "_hidden_value = true" to read only fields on custom object when showReadOnlyValue flag = false', async () => {
      const dataManagementConfig = {
        includeObjects: ['*'],
        saltoIDSettings: {} as SaltoIDSettings,
        showReadOnlyValues: false,
      } as DataManagementConfig

      const config = {
        ..._.omit(defaultFilterContext, 'fetchProfile'),
        fetchProfile: {
          ...defaultFilterContext.fetchProfile,
          dataManagement: buildDataManagement(dataManagementConfig),
        },
      }
      filter = filterCreator({ config }) as FilterType
      await filter.onFetch(elements)
      const customObjAfterFilter = elements[0] as ObjectType
      expect(customObjAfterFilter).toBeDefined()
      expect(
        customObjAfterFilter.fields.readOnlyField.annotations[
          CORE_ANNOTATIONS.HIDDEN_VALUE
        ],
      ).toBeTruthy()
      expect(
        customObjAfterFilter.fields.nonCreateableField.annotations[
          CORE_ANNOTATIONS.HIDDEN_VALUE
        ],
      ).toBeUndefined()
      expect(
        customObjAfterFilter.fields.nonUpdateableField.annotations[
          CORE_ANNOTATIONS.HIDDEN_VALUE
        ],
      ).toBeUndefined()
    })
    it('Should do nothing to read only fields on custom object when showReadOnlyValue flag = true', async () => {
      const dataManagementConfig = {
        includeObjects: ['*'],
        saltoIDSettings: {} as SaltoIDSettings,
        showReadOnlyValues: true,
      } as DataManagementConfig

      const config = {
        ..._.omit(defaultFilterContext, 'fetchProfile'),
        fetchProfile: {
          ...defaultFilterContext.fetchProfile,
          dataManagement: buildDataManagement(dataManagementConfig),
        },
      }
      filter = filterCreator({ config }) as FilterType
      await filter.onFetch(elements)
      const customObjAfterFilter = elements[0] as ObjectType
      expect(customObjAfterFilter).toBeDefined()
      expect(
        customObjAfterFilter.fields.readOnlyField.annotations[
          CORE_ANNOTATIONS.HIDDEN_VALUE
        ],
      ).toBeUndefined()
      expect(
        customObjAfterFilter.fields.nonCreateableField.annotations[
          CORE_ANNOTATIONS.HIDDEN_VALUE
        ],
      ).toBeUndefined()
      expect(
        customObjAfterFilter.fields.nonUpdateableField.annotations[
          CORE_ANNOTATIONS.HIDDEN_VALUE
        ],
      ).toBeUndefined()
    })
  })
})
