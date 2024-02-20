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
  InstanceElement,
  Element,
  isEqualElements,
  isObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { DetailedDependency } from '@salto-io/adapter-utils'
import ZuoraClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { ZUORA_BILLING, CUSTOM_OBJECT_DEFINITION_TYPE, STANDARD_OBJECT_DEFINITION_TYPE } from '../../src/constants'
import filterCreator from '../../src/filters/object_defs'
import { SUPPORTED_TYPES } from '../../src/config'

describe('Object defs filter', () => {
  let client: ZuoraClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const generateElements = (): Element[] => {
    const customObjectDefType = new ObjectType({
      elemID: new ElemID(ZUORA_BILLING, CUSTOM_OBJECT_DEFINITION_TYPE),
      path: [ZUORA_BILLING, 'Types', 'CustomObjectDefinitions'],
    })
    const standardObjectDefType = new ObjectType({
      elemID: new ElemID(ZUORA_BILLING, STANDARD_OBJECT_DEFINITION_TYPE),
    })

    const account = new InstanceElement('account', standardObjectDefType, {
      additionalProperties: {
        type: 'account',
      },
      schema: {
        $schema: 'http://json-schema.org/draft-04/schema#',
        title: 'Account',
        type: 'object',
        required: ['Id', 'CreatedById', 'AccountNumber', 'Name'],
        properties: {
          Id: {
            type: 'string',
            format: 'uuid',
          },
          CreatedById: {
            type: 'string',
            format: 'uuid',
          },
          additionalProperties: {
            AccountNumber: {
              type: 'string',
              additionalProperties: {
                maxLength: 512,
              },
            },
            Name: {
              type: 'string',
              additionalProperties: {
                maxLength: 512,
              },
            },
          },
        },
        relationships: [
          {
            cardinality: 'oneToMany',
            namespace: 'default',
            object: 'Custom1',
            fields: {
              additionalProperties: {
                Id: 'AccountId__c',
              },
            },
            recordConstraints: {
              create: {
                enforceValidMapping: false,
              },
            },
          },
        ],
      },
    })
    const accountingcode = new InstanceElement('AccountingCode', standardObjectDefType, {
      additionalProperties: {
        type: 'AccountingCode',
      },
      schema: {
        $schema: 'http://json-schema.org/draft-04/schema#',
        title: 'AccountingCode',
        type: 'object',
        required: ['Name', 'Id'],
        properties: {
          additionalProperties: {
            deleted: {
              type: 'boolean',
            },
            Category: {
              type: 'string',
              maxLength: 512,
            },
          },
          Id: {
            type: 'string',
            format: 'uuid',
          },
        },
      },
    })
    const Custom1 = new InstanceElement('Custom1', customObjectDefType, {
      additionalProperties: {
        Id: 'some id',
        type: 'Custom1',
      },
      CreatedById: 'id1',
      UpdatedById: 'id1',
      CreatedDate: '2021-01-01T01:23:45.678Z',
      UpdatedDate: '2021-01-01T01:23:45.678Z',
      schema: {
        object: 'Custom1',
        label: 'Custom1',
        properties: {
          additionalProperties: {
            field1__c: {
              format: 'uuid',
              label: 'field1 label',
              origin: 'custom',
              type: 'string',
              additionalProperties: {
                description: 'some description',
              },
            },
            field2__c: {
              label: 'field2 label',
              type: 'number',
            },
            SubscriptionId__c: {
              format: 'uuid',
              label: 'Subscription',
              origin: 'custom',
              type: 'string',
              additionalProperties: {
                description: 'The subscription that is associated with the record.',
              },
            },
            AccountId__c: {
              format: 'uuid',
              label: 'Account',
              origin: 'custom',
              type: 'string',
              additionalProperties: {
                description: 'The account that is associated with the record.',
              },
            },
            Custom2Id__c: {
              format: 'uuid',
              label: 'Custom2',
              origin: 'custom',
              type: 'string',
            },
          },
          Id: {
            format: 'uuid',
            label: 'Id',
            origin: 'system',
            type: 'string',
          },
        },
        required: ['field2__c', 'Id', 'AccountId__c'],
        description: 'this is a decription',
        filterable: ['field2__c', 'Id'],
        relationships: [
          {
            cardinality: 'manyToOne',
            namespace: 'com_zuora',
            object: 'subscription',
            fields: {
              additionalProperties: {
                SubscriptionId__c: 'Id',
              },
            },
            recordConstraints: {
              create: {
                enforceValidMapping: false,
              },
            },
          },
          {
            cardinality: 'manyToOne',
            namespace: 'com_zuora',
            object: 'account',
            fields: {
              additionalProperties: {
                AccountId__c: 'Id',
              },
            },
            recordConstraints: {
              create: {
                enforceValidMapping: false,
              },
            },
          },
          {
            cardinality: 'oneToMany',
            namespace: 'com_zuora',
            object: 'account',
            fields: {
              additionalProperties: {
                Id: 'Id',
              },
            },
          },
          {
            cardinality: 'manyToOne',
            namespace: 'default',
            object: 'Custom2',
            fields: {
              additionalProperties: {
                Custom2Id__c: 'Id',
              },
            },
            recordConstraints: {
              create: {
                enforceValidMapping: false,
              },
            },
          },
        ],
      },
    })
    const Custom2 = new InstanceElement('Custom2', customObjectDefType, {
      additionalProperties: {
        Id: 'some other id',
        type: 'Custom2',
      },
      CreatedById: 'id1',
      UpdatedById: 'id1',
      CreatedDate: '2021-01-01T01:23:45.678Z',
      UpdatedDate: '2021-01-01T01:23:45.678Z',
      schema: {
        object: 'Custom2',
        label: 'Custom2',
        properties: {
          Id: {
            format: 'uuid',
            label: 'Id',
            origin: 'system',
            type: 'string',
          },
        },
        required: [],
        description: 'this is a decription',
        filterable: [],
        // not supposed to happen
        relationships: {},
      },
    })
    return [customObjectDefType, standardObjectDefType, account, accountingcode, Custom1, Custom2]
  }

  beforeAll(() => {
    client = new ZuoraClient({
      credentials: { baseURL: 'http://localhost', clientId: 'id', clientSecret: 'secret' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: {
        fetch: {
          include: [],
          exclude: [],
        },
        apiDefinitions: {
          swagger: { url: 'ignore' },
          typeDefaults: {
            transformation: {
              idFields: ['name'],
            },
          },
          types: {},
          supportedTypes: SUPPORTED_TYPES,
        },
      },
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })
  describe('nothing to do', () => {
    it('keep elements as-is when custom object def is missing', async () => {
      const origElements = generateElements()
      const elements = generateElements().slice(1)
      await filter.onFetch(elements)
      expect(elements.length).toEqual(origElements.length - 1)
      expect(elements.every((e, i) => isEqualElements(e, origElements[i + 1]))).toBeTruthy()
    })
  })

  describe('convert instances to object types and fields', () => {
    let origElements: Element[]
    let elements: Element[]
    beforeAll(async () => {
      origElements = generateElements()
      elements = generateElements()
      await filter.onFetch(elements)
    })
    it('replace each instance with an object', () => {
      expect(elements.length).toEqual(origElements.length)
      expect(elements.every(isObjectType)).toBeTruthy()
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zuora_billing.AccountingCode',
        'zuora_billing.Custom1__c',
        'zuora_billing.Custom2__c',
        'zuora_billing.CustomObjectDefinition',
        'zuora_billing.StandardObjectDefinition',
        'zuora_billing.account',
      ])
    })
    it('should create standard objects and fields correctly', () => {
      const account = elements.find(e => e.elemID.typeName === 'account') as ObjectType
      const accountingcode = elements.find(e => e.elemID.typeName === 'AccountingCode') as ObjectType
      expect(account).toBeInstanceOf(ObjectType)
      expect(accountingcode).toBeInstanceOf(ObjectType)
      expect(_.mapValues(account.fields, f => f.refType.elemID.getFullName())).toEqual({
        AccountNumber: 'string',
        CreatedById: 'string',
        Id: 'string',
        Name: 'string',
      })
      expect(_.mapValues(accountingcode.fields, f => f.refType.elemID.getFullName())).toEqual({
        deleted: 'boolean',
        Category: 'string',
        Id: 'string',
      })
      expect(account.fields.Id.annotations).toEqual({
        filterable: false,
        format: 'uuid',
        required: true,
        type: 'string',
      })
      expect(account.annotations).toEqual({
        metadataType: 'StandardObject',
      })
    })
    it('should create custom objects and fields correctly, with the __c suffix', () => {
      const custom1 = elements.find(e => e.elemID.typeName === 'Custom1__c') as ObjectType
      expect(custom1).toBeInstanceOf(ObjectType)
      expect(_.mapValues(custom1.fields, f => f.refType.elemID.getFullName())).toEqual({
        field1__c: 'string',
        field2__c: 'number',
        SubscriptionId__c: 'string',
        AccountId__c: 'string',
        Custom2Id__c: 'string',
        Id: 'string',
      })
      expect(custom1.fields.Id.annotations).toEqual({
        filterable: true,
        format: 'uuid',
        label: 'Id',
        origin: 'system',
        required: true,
        type: 'string',
      })
      expect(custom1.fields.SubscriptionId__c.annotations).toEqual({
        format: 'uuid',
        label: 'Subscription',
        description: 'The subscription that is associated with the record.',
        origin: 'custom',
        type: 'string',
        filterable: false,
        required: false,
        cardinality: 'manyToOne',
        recordConstraints: { create: { enforceValidMapping: false } },
        // not a reference because subscription was not found
        referenceTo: ['subscription.Id'],
      })
      expect(custom1.fields.Custom2Id__c.annotations).toEqual({
        format: 'uuid',
        label: 'Custom2',
        origin: 'custom',
        type: 'string',
        filterable: false,
        required: false,
        cardinality: 'manyToOne',
        recordConstraints: { create: { enforceValidMapping: false } },
        referenceTo: [expect.any(ReferenceExpression)],
      })
      const fieldRef = custom1.fields.Custom2Id__c.annotations.referenceTo[0] as ReferenceExpression
      expect(fieldRef.elemID.getFullName()).toEqual('zuora_billing.Custom2__c.field.Id')
      const custom2 = elements.find(e => e.elemID.typeName === 'Custom2__c') as ObjectType
      expect(custom2).toBeInstanceOf(ObjectType)
      expect(_.mapValues(custom2.fields, f => f.refType.elemID.getFullName())).toEqual({ Id: 'string' })
      expect(custom1.fields.Id.annotations).toEqual({
        filterable: true,
        format: 'uuid',
        label: 'Id',
        origin: 'system',
        required: true,
        type: 'string',
      })
    })
    it('should create the right references, ignoring lower/uppercase in type names', () => {
      const custom1 = elements.find(e => e.elemID.typeName === 'Custom1__c') as ObjectType
      expect(custom1).toBeInstanceOf(ObjectType)
      expect(custom1.fields.AccountId__c.annotations).toEqual({
        format: 'uuid',
        label: 'Account',
        description: 'The account that is associated with the record.',
        origin: 'custom',
        type: 'string',
        filterable: false,
        required: true,
        cardinality: 'manyToOne',
        recordConstraints: { create: { enforceValidMapping: false } },
        // not a reference because subscription was not found
        referenceTo: [expect.any(ReferenceExpression)],
      })
      const fieldRef = custom1.fields.AccountId__c.annotations.referenceTo[0] as ReferenceExpression
      expect(fieldRef.elemID.getFullName()).toEqual('zuora_billing.account.field.Id')
      expect(custom1.annotations).toEqual({
        // eslint-disable-next-line camelcase
        _generated_dependencies: [expect.anything(), expect.anything()],
        description: 'this is a decription',
        id: 'some id',
        label: 'Custom1',
        metadataType: 'CustomObject',
      })
      // eslint-disable-next-line no-underscore-dangle
      const objRefs = custom1.annotations._generated_dependencies as DetailedDependency[]
      expect(objRefs[0].reference.elemID.getFullName()).toEqual('zuora_billing.Custom2__c')
      expect(objRefs[1].reference.elemID.getFullName()).toEqual('zuora_billing.account')
    })
  })
})
