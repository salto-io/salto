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
import { Values } from '@salto-io/adapter-api'
import { fetchDefault } from '../../src/config/types'
import { validateConfig } from '../../src/config/validations'
import { getDefaultAdapterConfig } from '../utils'

describe('netsuite config validations', () => {
  let config: Values

  beforeEach(async () => {
    config = await getDefaultAdapterConfig()
  })

  describe('simple config', () => {
    it('should not throw on a valid config', () => {
      config.includeAllSavedSearches = true
      config.includeCustomRecords = ['customrecord1', 'customrecord2']
      config.includeInactiveRecords = ['All']
      config.includeDataFileTypes = ['Documents (DOC, DOCX)', 'pdf']
      config.includeFileCabinetFolders = ['/test1', '/test2/', 'test3/', 'test4']
      expect(() => validateConfig(config)).not.toThrow()
    })

    it('should not throw on empty lists', () => {
      config.includeAllSavedSearches = true
      config.includeCustomRecords = []
      config.includeInactiveRecords = []
      config.includeDataFileTypes = []
      config.includeFileCabinetFolders = []
      expect(() => validateConfig(config)).not.toThrow()
    })

    it('should throw an error if includeAllSavedSearches is not boolean', () => {
      config.includeAllSavedSearches = 'true'
      expect(() => validateConfig(config)).toThrow('Expected "includeAllSavedSearches" to be a boolean')
    })

    it('should throw an error if includeCustomRecords', () => {
      config.includeCustomRecords = 'customrecord1'
      expect(() => validateConfig(config)).toThrow('includeCustomRecords should be a list of strings')
    })

    it('should throw an error if includeInactiveRecords', () => {
      config.includeInactiveRecords = [true]
      expect(() => validateConfig(config)).toThrow('includeInactiveRecords should be a list of strings')
    })

    it('should throw an error if includeDataFileTypes', () => {
      config.includeDataFileTypes = ['Documents (DOC, DOCX)', 1]
      expect(() => validateConfig(config)).toThrow('includeDataFileTypes should be a list of strings')
    })

    it('should throw an error if includeFileCabinetFolders', () => {
      config.includeFileCabinetFolders = null
      expect(() => validateConfig(config)).toThrow('includeFileCabinetFolders should be a list of strings')
    })
  })

  describe('fetch config', () => {
    it('should not throw on a valid fetch config', () => {
      expect(() => validateConfig(config)).not.toThrow()
    })

    it('should throw an error if the fetch is undefined', () => {
      config.fetch = undefined
      expect(() => validateConfig(config)).toThrow('Failed to load Netsuite config: fetch should be defined')
    })

    it('should throw an error if the include is undefined', () => {
      config.fetch.include = undefined
      expect(() => validateConfig(config)).toThrow('Failed to load Netsuite config: fetch.include should be defined')
    })

    it('should throw an error if the include is non-valid', () => {
      config.fetch.include = {}
      expect(() => validateConfig(config)).toThrow('Failed to load Netsuite config: Received invalid adapter config input. "types" field is expected to be an array\n "fileCabinet" field is expected to be an array\n')
    })

    it('should throw an error if the exclude is undefined', () => {
      config.fetch.exclude = undefined
      expect(() => validateConfig(config)).toThrow('Failed to load Netsuite config: fetch.exclude should be defined')
    })

    it('should throw an error if the exclude is non-valid', () => {
      config.fetch.exclude = {}
      expect(() => validateConfig(config)).toThrow('Failed to load Netsuite config: Received invalid adapter config input. "types" field is expected to be an array\n "fileCabinet" field is expected to be an array\n')
    })

    it('should throw an error if include contains criteria query', () => {
      config.fetch.include.types.push({ name: '.*', criteria: { isinactive: false } })
      expect(() => validateConfig(config)).toThrow('Failed to load Netsuite config: The "criteria" configuration option is exclusively permitted within the "fetch.exclude" configuration and should not be used within the "fetch.include" configuration.')
    })

    it('should not throw an error if exclude contains criteria query', () => {
      config.fetch.exclude.types.push({ name: '.*', criteria: { isinactive: false } })
      expect(() => validateConfig(config)).not.toThrow()
    })

    describe('default fetch config', () => {
      it('should exclude all types in a correct syntax', () => {
        expect(fetchDefault.exclude.types)
          .toContainEqual({
            name: 'assemblyItem|lotNumberedAssemblyItem|serializedAssemblyItem|descriptionItem|discountItem|kitItem|markupItem|nonInventoryPurchaseItem|nonInventorySaleItem|nonInventoryResaleItem|otherChargeSaleItem|otherChargeResaleItem|otherChargePurchaseItem|paymentItem|serviceResaleItem|servicePurchaseItem|serviceSaleItem|subtotalItem|inventoryItem|lotNumberedInventoryItem|serializedInventoryItem|itemGroup',
          })
      })
    })

    describe('fetch parameters', () => {
      it('valid query should not throw exception', () => {
        config.fetch.exclude = {
          types: [
            { name: 'addressForm', ids: ['aaa.*', 'bbb.*'] },
            { name: 'advancedpdftemplate', ids: ['ccc.*', 'ddd.*'] },
            { name: '.*', criteria: { isinactive: true } },
          ],
          fileCabinet: ['eee.*', 'fff.*'],
          customRecords: [
            { name: 'customrecord.*', ids: ['.*'] },
            { name: '.*', criteria: { isInactive: true } },
          ],
        }
        expect(() => validateConfig(config)).not.toThrow()
      })

      it('invalid regexes should throw an error with the regexes', () => {
        config.fetch.include = {
          types: [
            { name: 'addressForm', ids: ['aa(a.*', 'bbb.*'] },
          ],
          fileCabinet: ['eee.*', 'f(ff.*'],
          customRecords: [
            { name: 'customrecord.*', ids: ['val_123.*', 'val_(456.*'] },
          ],
        }
        expect(() => validateConfig(config)).toThrow('The following regular expressions are invalid:\naa(a.*,val_(456.*,f(ff.*.')
      })

      it('should throw an error when type has invalid "name" reg expression', () => {
        config.fetch.include = {
          types: [{
            name: 'aa(a.*',
          }],
          fileCabinet: [],
        }
        expect(() => validateConfig(config)).toThrow('The following regular expressions are invalid:\naa(a.*.')
      })

      it('should throw an error when type has undefined "name"', () => {
        config.fetch.include = {
          types: [{ name: 'aa' }, {}],
          fileCabinet: [],
        }
        expect(() => validateConfig(config)).toThrow('Received invalid adapter config input. Expected the type name to be a string without both "ids" and "criteria", but found:')
      })

      it('should throw an error when type has both ids & criteria', () => {
        config.fetch.include = {
          types: [
            {
              name: 'aa',
              ids: ['abc'],
              criteria: { isinactive: true },
            },
          ],
          fileCabinet: [],
        }
        expect(() => validateConfig(config)).toThrow('Received invalid adapter config input. Expected the type name to be a string without both "ids" and "criteria", but found:')
      })

      it('should throw an error when customRecords has undefined "name"', () => {
        config.fetch.include = {
          types: [],
          fileCabinet: [],
          customRecords: [
            { name: 'aa' },
            {},
          ],
        }
        expect(() => validateConfig(config)).toThrow('Received invalid adapter config input. Expected the custom record name to be a string without both "ids" and "criteria", but found:')
      })

      it('should throw an error when customRecords has both ids & criteria', () => {
        config.fetch.include = {
          types: [],
          fileCabinet: [],
          customRecords: [
            { name: 'aa' },
            { name: '.*', ids: ['abc'], criteria: { isinactive: true } },
          ],
        }
        expect(() => validateConfig(config)).toThrow('Received invalid adapter config input. Expected the custom record name to be a string without both "ids" and "criteria", but found:')
      })

      it('should throw an error when fileCabinet is undefined', () => {
        config.fetch.include = {
          types: [{
            name: 'aaa',
          }],
        }
        expect(() => validateConfig(config)).toThrow('Received invalid adapter config input. "fileCabinet" field is expected to be an array')
      })

      it('should throw an error when types is undefined', () => {
        config.fetch.include = {
          fileCabinet: [],
        }
        expect(() => validateConfig(config)).toThrow('Received invalid adapter config input. "types" field is expected to be an array')
      })

      it('should throw an error when customRecords is not array', () => {
        config.fetch.include = {
          types: [],
          fileCabinet: [],
          customRecords: {},
        }
        expect(() => validateConfig(config)).toThrow('Received invalid adapter config input. "customRecords" field is expected to be an array')
      })

      it('should throw an error when types has invalid ids field', () => {
        config.fetch.include = {
          types: [{
            name: 'aaa',
            ids: ['string', 1],
          }],
          fileCabinet: [],
        }
        expect(() => validateConfig(config)).toThrow('Received invalid adapter config input. Expected type "ids" to be an array of strings, but found:')
      })

      it('should throw an error when types has invalid criteria field', () => {
        config.fetch.include = {
          types: [
            {
              name: 'aaa',
              criteria: { inactive: true },
            },
            {
              name: 'aaa',
              criteria: true,
            },
            {
              name: 'aaa',
              criteria: {},
            },
          ],
          fileCabinet: [],
        }
        expect(() => validateConfig(config)).toThrow('Received invalid adapter config input. Expected type "criteria" to be a non-empty object, but found:')
      })

      it('should throw an error when customRecords has invalid ids field', () => {
        config.fetch.include = {
          types: [],
          fileCabinet: [],
          customRecords: [{
            name: 'aaa',
            ids: ['string', 1],
          }],
        }
        expect(() => validateConfig(config)).toThrow('Received invalid adapter config input. Expected custom record "ids" to be an array of strings, but found:')
      })

      it('should throw an error when customRecords has invalid criteria field', () => {
        config.fetch.include = {
          types: [],
          fileCabinet: [],
          customRecords: [{
            name: 'aaa',
            criteria: {},
          }],
        }
        expect(() => validateConfig(config)).toThrow('Received invalid adapter config input. Expected custom record "criteria" to be a non-empty object, but found:')
      })

      it('should throw an error with all invalid types', () => {
        config.fetch.include = {
          types: [
            { name: 'addressForm', ids: ['.*'] },
            { name: 'invalidType', ids: ['.*'] },
          ],
          fileCabinet: [],
        }
        expect(() => validateConfig(config)).toThrow('The following types or regular expressions do not match any supported type:\ninvalidType.')
      })
    })

    describe('fields to omit', () => {
      it('should not throw', () => {
        config.fetch.fieldsToOmit = [{ type: 'a', fields: ['b'] }]
        expect(() => validateConfig(config)).not.toThrow()

        config.fetch.fieldsToOmit = [{ type: 'a', subtype: 'c', fields: ['b'] }]
        expect(() => validateConfig(config)).not.toThrow()
      })

      it('should throw an error when input is not an array', () => {
        config.fetch.fieldsToOmit = { type: 'a', fields: ['b'] }
        expect(() => validateConfig(config)).toThrow('"fieldsToOmit" field is expected to be an array')
      })

      it('should throw an error when "type" field is not a string', () => {
        config.fetch.fieldsToOmit = [{ type: { name: 'a' }, fields: ['b'] }]
        expect(() => validateConfig(config)).toThrow('Expected "type" field to be a string')
      })

      it('should throw an error when "subtype" field is not a string', () => {
        config.fetch.fieldsToOmit = [{ type: 'a', subtype: { name: 'c' }, fields: ['b'] }]
        expect(() => validateConfig(config)).toThrow('Expected "subtype" field to be a string')
      })

      it('should throw an error when "fields" field is not an array', () => {
        config.fetch.fieldsToOmit = [{ type: 'a', fields: 'b' }]
        expect(() => validateConfig(config)).toThrow('Expected "fields" field to be an array of strings')
      })

      it('should throw an error when "fields" field is an empty array', () => {
        config.fetch.fieldsToOmit = [{ type: 'a', fields: [] }]
        expect(() => validateConfig(config)).toThrow('Expected "fields" field to be an array of strings')
      })

      it('should throw an error when regexes are invalid', () => {
        config.fetch.fieldsToOmit = [{ type: 'aa(a.*', fields: ['bb(b.*'] }]
        expect(() => validateConfig(config)).toThrow('The following regular expressions are invalid')

        config.fetch.fieldsToOmit = [{ type: 'aaa.*', subtype: 'cc(c.*', fields: ['bbb.*'] }]
        expect(() => validateConfig(config)).toThrow('The following regular expressions are invalid')
      })
    })

    describe('skip resolving account specific values to types', () => {
      it('should not throw', () => {
        config.fetch.skipResolvingAccountSpecificValuesToTypes = []
        expect(() => validateConfig(config)).not.toThrow()

        config.fetch.skipResolvingAccountSpecificValuesToTypes = ['.*']
        expect(() => validateConfig(config)).not.toThrow()
      })
      it('should throw if value is not a list of strings', () => {
        config.fetch.skipResolvingAccountSpecificValuesToTypes = '.*'
        expect(() => validateConfig(config)).toThrow('fetch.skipResolvingAccountSpecificValuesToTypes should be a list of strings')
      })
      it('should throw if value contain invalid regex', () => {
        config.fetch.skipResolvingAccountSpecificValuesToTypes = ['.*', '(']
        expect(() => validateConfig(config)).toThrow('The following regular expressions are invalid: (')
      })
    })
  })

  describe('client config', () => {
    describe('validate maxInstancesPerType', () => {
      it('should validate maxInstancesPerType is the correct object with valid NS types', () => {
        config.client = {
          maxInstancesPerType: [{ name: 'customsegment', limit: 3 }],
        }
        expect(() => validateConfig(config)).not.toThrow()
      })

      it('should validate also customrecordtype instances', () => {
        config.client = {
          maxInstancesPerType: [{ name: 'customrecord_ForTesting', limit: 3 }],
        }
        expect(() => validateConfig(config)).not.toThrow()
      })

      it('should throw if maxInstancesPerType is the wrong object', () => {
        config.client = {
          maxInstancesPerType: [{ wrong_name: 'customsegment', limit: 3 }],
        }
        expect(() => validateConfig(config)).toThrow()
      })

      it('should throw if maxInstancesPerType is the correct object with invalid NS types', () => {
        config.client = {
          maxInstancesPerType: [{ name: 'not_supported_type', limit: 3 }],
        }
        expect(() => validateConfig(config)).toThrow()
      })
    })
  })
})
