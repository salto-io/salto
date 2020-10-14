/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ElemID, ObjectType, Element, CORE_ANNOTATIONS, PrimitiveType, PrimitiveTypes, ServiceIds,
  InstanceElement, BuiltinTypes } from '@salto-io/adapter-api'
import { getNamespaceFromString } from '../../src/filters/utils'
import { FilterWith } from '../../src/filter'
import SalesforceClient from '../../src/client/client'
import Connection from '../../src/client/jsforce'
import filterCreator from '../../src/filters/custom_settings_filter'
import mockAdapter from '../adapter'
import {
  LABEL, CUSTOM_OBJECT, API_NAME, METADATA_TYPE, SALESFORCE, INSTALLED_PACKAGES_PATH,
  OBJECTS_PATH, CUSTOM_SETTINGS_TYPE, FIELD_ANNOTATIONS,
} from '../../src/constants'

const stringType = new PrimitiveType({
  elemID: new ElemID(SALESFORCE, 'Text'),
  primitive: PrimitiveTypes.STRING,
  annotationTypes: {
    [LABEL]: BuiltinTypes.STRING,
  },
})
const idType = new PrimitiveType({
  elemID: new ElemID('id'),
  primitive: PrimitiveTypes.STRING,
})
export const createCustomSettingsObject = (
  name: string,
  settingsType: string,
): ObjectType => {
  const namespace = getNamespaceFromString(name)
  const basicFields = {
    Id: {
      type: idType,
      label: 'id',
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [LABEL]: 'Record ID',
        [API_NAME]: 'Id',
      },
    },
    Name: {
      type: stringType,
      label: 'Name',
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [LABEL]: 'Name',
        [API_NAME]: 'Name',
        [FIELD_ANNOTATIONS.CREATABLE]: true,
      },
    },
    // eslint-disable-next-line @typescript-eslint/camelcase
    TestField__c: {
      label: 'TestField',
      type: stringType,
      annotations: {
        [LABEL]: 'TestField',
        [API_NAME]: `${name}.TestField__c`,
        [FIELD_ANNOTATIONS.CREATABLE]: true,
      },
      annotationTypes: {
        [LABEL]: BuiltinTypes.STRING,
        [API_NAME]: BuiltinTypes.STRING,
      },
    },
  }
  const obj = new ObjectType({
    elemID: new ElemID(SALESFORCE, name),
    annotations: {
      [API_NAME]: name,
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [CUSTOM_SETTINGS_TYPE]: settingsType,
    },
    annotationTypes: {
      [CUSTOM_SETTINGS_TYPE]: BuiltinTypes.STRING,
      [METADATA_TYPE]: BuiltinTypes.STRING,
    },
    fields: basicFields,
  })
  const path = namespace
    ? [SALESFORCE, INSTALLED_PACKAGES_PATH, namespace, OBJECTS_PATH, obj.elemID.name]
    : [SALESFORCE, OBJECTS_PATH, obj.elemID.name]
  obj.path = path
  return obj
}
/* eslint-disable @typescript-eslint/camelcase */
describe('Custom settings filter', () => {
  let connection: Connection
  let client: SalesforceClient
  type FilterType = FilterWith<'onFetch'>
  let filter: FilterType

  const NAME_FROM_GET_ELEM_ID = 'getElemIDPrefix'
  const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string):
    ElemID => new ElemID(adapterName, `${NAME_FROM_GET_ELEM_ID}${name}`)
  const TestCustomSettingsRecords = [
    {
      attributes: {
        type: 'Test',
      },
      Id: '1',
      Name: 'TestName1',
    },
    {
      attributes: {
        type: 'Test',
      },
      Id: '2',
      Name: 'TestName2',
    },
  ]

  let basicQueryImplementation: jest.Mock

  beforeEach(() => {
    ({ connection, client } = mockAdapter({
      adapterParams: {
        getElemIdFunc: mockGetElemIdFunc,
      },
    }))
    basicQueryImplementation = jest.fn().mockImplementation(async () => (
      {
        totalSize: 2,
        done: true,
        records: TestCustomSettingsRecords,
      }))
    connection.query = basicQueryImplementation
  })

  describe('Custom settings filter ', () => {
    const customSettingsObject = createCustomSettingsObject('configurationobj', 'List')
    let elements: Element[]
    beforeEach(() => {
      filter = filterCreator(
        {
          client,
          config: {
            dataManagement: undefined,
          },
        }
      ) as FilterType
    })

    beforeEach(async () => {
      elements = [
        customSettingsObject,
      ]
      await filter.onFetch(elements)
    })

    it('should add two instances', () => {
      expect(elements).toHaveLength(3)
      expect((elements[1] as InstanceElement).value.Name).toEqual('TestName1')
      expect((elements[2] as InstanceElement).value.Name).toEqual('TestName2')
    })
  })

  describe('Custom settings filter ignores hierarchical', () => {
    const customSettingsObject = createCustomSettingsObject('configurationobj', 'Hierarchical')
    let elements: Element[]
    beforeEach(() => {
      filter = filterCreator(
        {
          client,
          config: {
            dataManagement: undefined,
          },
        }
      ) as FilterType
    })

    beforeEach(async () => {
      elements = [
        customSettingsObject,
      ]
      await filter.onFetch(elements)
    })

    it('should result to add zero instances', () => {
      expect(elements).toHaveLength(1)
    })
  })
})
