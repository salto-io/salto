/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { ElemID } from '@salto-io/adapter-api'
import { generateInstanceNameFromConfig, getInstanceNaclName } from '../../src/elements/instance_elements'
import { NameMappingOptions } from '../../src/config'

describe('generateInstanceNameFromConfig', () => {
  it('should return the name of the instance based on the type config', () => {
    expect(generateInstanceNameFromConfig(
      {
        name: 'name',
        id: 'id',
      },
      'test',
      {
        typeDefaults: {
          transformation: {
            idFields: ['name'],
          },
        },
        types: {
          test: {
            transformation: {
              idFields: ['id'],
            },
          },
        },
        supportedTypes: {},
      }
    )).toBe('id')
  })
  it('should return the name of the type based on the type default when there is no type config', () => {
    expect(generateInstanceNameFromConfig(
      {
        name: 'name',
        id: 'id',
      },
      'test',
      {
        typeDefaults: {
          transformation: {
            idFields: ['name'],
          },
        },
        types: {},
        supportedTypes: {},
      }
    )).toBe('name')
  })
  it('should covert name if nameMapping exists', () => {
    const lowercaseTransfomation : NameMappingOptions = 'lowercase'
    const uppercaseTransfomation : NameMappingOptions = 'uppercase'
    expect(generateInstanceNameFromConfig(
      {
        name: 'name',
        id: 'Id',
      },
      'test',
      {
        typeDefaults: {
          transformation: {
            idFields: ['id'],
            nameMapping: lowercaseTransfomation,
          },
        },
        types: {},
        supportedTypes: {},
      }
    )).toBe('id')
    expect(generateInstanceNameFromConfig(
      {
        name: 'name',
        id: 'Id',
      },
      'test',
      {
        typeDefaults: {
          transformation: {
            idFields: ['id'],
            nameMapping: uppercaseTransfomation,
          },
        },
        types: {},
        supportedTypes: {},
      }
    )).toBe('ID')
    expect(generateInstanceNameFromConfig(
      {
        name: 'name',
        id: 'Id',
      },
      'test',
      {
        typeDefaults: {
          transformation: {
            idFields: ['id'],
          },
        },
        types: {},
        supportedTypes: {},
      }
    )).toBe('Id')
  })
})

describe('getInstanceNaclName', () => {
  it('should return a naclName of the parentName without __ suffix, when the name is empty', () => {
    const naclNameEmptyName = getInstanceNaclName({
      entry: {},
      name: '',
      parentName: 'parent',
      adapterName: 'zendesk',
      typeElemId: new ElemID('zendesk', 'test'),
    })
    const naclNameRegular = getInstanceNaclName({
      entry: {},
      name: 'name',
      parentName: 'parent',
      adapterName: 'zendesk',
      typeElemId: new ElemID('zendesk', 'test'),
    })
    expect(naclNameEmptyName).toBe('parent')
    expect(naclNameRegular).toBe('parent__name')
  })
})
