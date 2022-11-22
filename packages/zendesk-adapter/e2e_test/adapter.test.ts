/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { v4 as uuidv4 } from 'uuid'
import { Change, ChangeId, Element, ElemID, InstanceElement, isInstanceElement, ObjectType,
  isObjectType, toChange, Values, ReferenceExpression, CORE_ANNOTATIONS,
  FieldDefinition, BuiltinTypes, Value, DeployResult } from '@salto-io/adapter-api'
import { naclCase, buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { config as configUtils } from '@salto-io/adapter-components'
import { values, collections } from '@salto-io/lowerdash'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import {
  DEFAULT_CONFIG,
  API_DEFINITIONS_CONFIG,
  FETCH_CONFIG,
  GUIDE_SUPPORTED_TYPES,
  SUPPORTED_TYPES,
} from '../src/config'
import { ZENDESK, BRAND_TYPE_NAME, CATEGORY_TRANSLATION_TYPE_NAME } from '../src/constants'
import { Credentials } from '../src/auth'
import { getChangeGroupIds } from '../src/group_change'
import { credsLease, realAdapter, Reals } from './adapter'
import { mockDefaultValues } from './mock_elements'

const { awu } = collections.asynciterable

const ALL_SUPPORTED_TYPES = {
  ...GUIDE_SUPPORTED_TYPES,
  ...SUPPORTED_TYPES,
}
// Set long timeout as we communicate with Zendesk APIs
jest.setTimeout(600000)

const createInstanceElement = (
  type: string, valuesOverride: Values, fields?: Record<string, FieldDefinition>
): InstanceElement => {
  const instValues = {
    ...mockDefaultValues[type],
    ...valuesOverride,
  }
  const transformationConfig = configUtils.getConfigWithDefault(
    DEFAULT_CONFIG[API_DEFINITIONS_CONFIG].types[type].transformation ?? {},
    DEFAULT_CONFIG[API_DEFINITIONS_CONFIG].typeDefaults.transformation,
  )

  const nameParts = transformationConfig.idFields.map(field => _.get(instValues, field))
  return new InstanceElement(
    naclCase(nameParts.map(String).join('_')),
    new ObjectType({ elemID: new ElemID(ZENDESK, type), fields }),
    instValues
  )
}

const deployChanges = async (
  adapterAttr: Reals, changes: Record<ChangeId, Change<InstanceElement>[]>
): Promise<DeployResult[]> => {
  const deployResults = await awu(Object.entries(changes))
    .map(async ([id, group]) => {
      const deployResult = await adapterAttr.adapter.deploy({
        changeGroup: { groupID: id, changes: group },
      })
      expect(deployResult.errors).toHaveLength(0)
      expect(deployResult.appliedChanges).not.toHaveLength(0)
      return deployResult
    })
    .toArray()
  return deployResults
}

const cleanup = async (adapterAttr: Reals): Promise<void> => {
  const fetchResult = await adapterAttr.adapter.fetch({
    progressReporter:
      { reportProgress: () => null },
  })
  expect(fetchResult.errors).toHaveLength(0)
  const { elements } = fetchResult
  const e2eBrandInstances = elements
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)
    .filter(brand => brand.elemID.name.startsWith('Testbrand'))
  if (e2eBrandInstances.length > 0) {
    await deployChanges(
      adapterAttr,
      { BRAND_TYPE_NAME: e2eBrandInstances.map(brand => toChange({ before: brand })) }
    )
  }
}

describe('Zendesk adapter E2E', () => {
  describe('fetch and deploy', () => {
    let credLease: CredsLease<Credentials>
    let adapterAttr: Reals
    const testSuffix = uuidv4().slice(0, 8)
    const testOptionValue = uuidv4().slice(0, 8)
    let elements: Element[] = []
    const createName = (type: string): string => `Test${type}${testSuffix}`
    const createSubdomainName = (): string => `test${testSuffix}`


    const automationInstance = createInstanceElement(
      'automation',
      {
        title: createName('automation'),
        conditions: {
          all: [
            {
              field: 'status',
              operator: 'is',
              value: 'solved',
            },
            {
              field: 'SOLVED',
              operator: 'greater_than',
              // Two automations can't have the same conditions
              value: Math.floor(Math.random() * 100000).toString(),
            },
          ],
        },
      },
    )
    const scheduleInstance = createInstanceElement(
      'business_hours_schedule',
      { name: createName('business_hours_schedule') },
    )
    const customRoleInstance = createInstanceElement(
      'custom_role',
      { name: createName('custom_role') },
    )
    const groupInstance = createInstanceElement(
      'group',
      { name: createName('group') },
    )
    const macroInstance = createInstanceElement(
      'macro',
      { title: createName('macro') },
    )
    const slaPolicyInstance = createInstanceElement(
      'sla_policy',
      { title: createName('sla_policy') },
    )
    const viewInstance = createInstanceElement(
      'view',
      { title: createName('view') },
    )
    const ticketFieldInstance = createInstanceElement(
      'ticket_field',
      { raw_title: createName('ticket_field') },
      { default_custom_field_option: { refType: BuiltinTypes.STRING } },
    )
    const ticketFieldOptionType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'ticket_field__custom_field_options'),
    })
    const ticketFieldOption1Name = `ticketFieldOption1${testSuffix}`
    const ticketFieldOption1Value = `v1t${testOptionValue}`
    const ticketFieldOption1 = new InstanceElement(
      `${ticketFieldInstance.elemID.name}__${ticketFieldOption1Value}`,
      ticketFieldOptionType,
      {
        name: ticketFieldOption1Name,
        raw_name: ticketFieldOption1Name,
        value: ticketFieldOption1Value,
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
          ticketFieldInstance.elemID, ticketFieldInstance
        ),
      },
    )
    const ticketFieldOption2Name = `ticketFieldOption2${testSuffix}`
    const ticketFieldOption2Value = `v2t${testOptionValue}`
    const ticketFieldOption2 = new InstanceElement(
      `${ticketFieldInstance.elemID.name}__${ticketFieldOption2Value}`,
      ticketFieldOptionType,
      {
        name: ticketFieldOption2Name,
        raw_name: ticketFieldOption2Name,
        value: ticketFieldOption2Value,
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
          ticketFieldInstance.elemID, ticketFieldInstance
        ),
      },
    )
    ticketFieldInstance.value.custom_field_options = [
      new ReferenceExpression(ticketFieldOption1.elemID, ticketFieldOption1),
      new ReferenceExpression(ticketFieldOption2.elemID, ticketFieldOption2),
    ]
    ticketFieldInstance.value.default_custom_field_option = new ReferenceExpression(
      ticketFieldOption1.elemID, ticketFieldOption1,
    )
    const userFieldName = createName('user_field')
    const userFieldInstance = createInstanceElement(
      'user_field',
      { raw_title: userFieldName, key: userFieldName },
    )
    const userFieldOptionType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'user_field__custom_field_options'),
    })
    const userFieldOption1Name = `userFieldOption1${testSuffix}`
    const userFieldOption1Value = `v1u${testOptionValue}`
    const userFieldOption1 = new InstanceElement(
      `${userFieldInstance.elemID.name}__${userFieldOption1Value}`,
      userFieldOptionType,
      {
        name: userFieldOption1Name,
        raw_name: userFieldOption1Name,
        value: userFieldOption1Value,
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
          userFieldInstance.elemID, userFieldInstance
        ),
      },
    )
    const userFieldOption2Name = `userFieldOption2${testSuffix}`
    const userFieldOption2Value = `v2u${testOptionValue}`
    const userFieldOption2 = new InstanceElement(
      `${userFieldInstance.elemID.name}__${userFieldOption2Value}`,
      userFieldOptionType,
      {
        name: userFieldOption2Name,
        raw_name: userFieldOption2Name,
        value: userFieldOption2Value,
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
          userFieldInstance.elemID, userFieldInstance
        ),
      },
    )
    userFieldInstance.value.custom_field_options = [
      new ReferenceExpression(userFieldOption1.elemID, userFieldOption1),
      new ReferenceExpression(userFieldOption2.elemID, userFieldOption2),
    ]
    const brandName = createName('brand')
    const brandInstanceToAdd = createInstanceElement(
      'brand',
      {
        name: brandName,
        subdomain: createSubdomainName(),
      },
    )
    const userSegmentInstance = createInstanceElement(
      'user_segment',
      { name: createName('user_segment'), user_type: 'signed_in_users', built_in: false },
    )
    // guide instances
    const categoryName = createName('category')
    const categoryInstance = createInstanceElement(
      'category',
      {
        name: categoryName,
      }
    )
    const categoryTranslationType = new ObjectType({
      elemID: new ElemID(ZENDESK, CATEGORY_TRANSLATION_TYPE_NAME),
    })
    const categoryTranslationInstance = new InstanceElement(
      `${categoryName}_en_us`,
      categoryTranslationType,
      {
        locale: 'en-us',
        outdated: false,
        title: categoryName,
        draft: false,
        hidden: false,
        description: 'this is a test',
        brand: 10378734785303,
      },
      undefined,

    )
    let groupIdToInstances: Record<string, InstanceElement[]>

    beforeAll(async () => {
      credLease = await credsLease()
      adapterAttr = realAdapter(
        { credentials: credLease.value, elementsSource: buildElementsSourceFromElements([]) },
        {
          ...DEFAULT_CONFIG,
          [FETCH_CONFIG]: {
            ...DEFAULT_CONFIG[FETCH_CONFIG],
            include: [
              { type: '.*' },
            ],
            exclude: [],
            enableGuide: true,
          },
          [API_DEFINITIONS_CONFIG]: {
            ...DEFAULT_CONFIG[API_DEFINITIONS_CONFIG],
            supportedTypes: ALL_SUPPORTED_TYPES,
          },
        }
      )
      await cleanup(adapterAttr)
      const instancesToAdd = [
        ticketFieldInstance,
        ticketFieldOption1,
        ticketFieldOption2,
        userFieldInstance,
        userFieldOption1,
        userFieldOption2,
        automationInstance,
        scheduleInstance,
        customRoleInstance,
        groupInstance,
        macroInstance,
        slaPolicyInstance,
        viewInstance,
        brandInstanceToAdd,
        userSegmentInstance,
      ]
      const changeGroups = await getChangeGroupIds(new Map<string, Change>(instancesToAdd
        .map(inst => [inst.elemID.getFullName(), toChange({ after: inst })])))
      groupIdToInstances = _.groupBy(
        instancesToAdd,
        inst => changeGroups.changeGroupIdMap.get(inst.elemID.getFullName())
      )
      const firstGroupChanges = _.mapValues(
        groupIdToInstances,
        instances => instances.map(inst => toChange({ after: inst }))
      )
      await deployChanges(adapterAttr, firstGroupChanges)
      const fetchResult = await adapterAttr.adapter.fetch({
        progressReporter:
          { reportProgress: () => null },
      })
      elements = fetchResult.elements
      expect(fetchResult.errors).toHaveLength(0)
    })

    afterAll(async () => {
      const firstGroupChanges = _.mapValues(
        groupIdToInstances,
        instancesToRemove => instancesToRemove.map(inst => {
          const instanceToRemove = elements.find(e => e.elemID.isEqual(inst.elemID))
          return instanceToRemove
            ? toChange({ before: instanceToRemove as InstanceElement })
            : undefined
        }).filter(values.isDefined)
      )
      await deployChanges(adapterAttr, firstGroupChanges)
      if (credLease.return) {
        await credLease.return()
      }
    })
    it('should fetch the regular instances and types', async () => {
      const typesToFetch = [
        'account_setting',
        'app_installation',
        'automation',
        'brand',
        'brand_logo',
        'business_hours_schedule',
        'custom_role',
        'dynamic_content_item',
        'group',
        'locale',
        'macro_categories',
        'macro',
        'oauth_client',
        'oauth_global_client',
        'organization',
        'organization_field',
        'resource_collection',
        'routing_attribute',
        'sharing_agreement',
        'sla_policy',
        'support_address',
        'target',
        'ticket_field',
        'ticket_form',
        'trigger_category',
        'trigger',
        'user_field',
        'view',
        'workspace',
      ]
      const typeNames = elements.filter(isObjectType).map(e => e.elemID.typeName)
      const instances = elements.filter(isInstanceElement)
      typesToFetch.forEach(typeName => {
        expect(typeNames).toContain(typeName)
        const instance = instances.find(e => e.elemID.typeName === typeName)
        expect(instance).toBeDefined()
      })
    })
    it('should fetch order elements', async () => {
      const orderElements = [
        'workspace_order',
        'user_field_order',
        'organization_field_order',
        'ticket_form_order',
        'sla_policy_order',
      ]
      const orderElementsElemIDs = orderElements.map(name => ({
        type: new ElemID(ZENDESK, name),
        instance: new ElemID(ZENDESK, name, 'instance', ElemID.CONFIG_NAME),
      }))
      orderElementsElemIDs.forEach(element => {
        const type = elements.find(e => e.elemID.isEqual(element.type))
        expect(type).toBeDefined()
        const instance = elements.find(e => e.elemID.isEqual(element.instance))
        expect(instance).toBeDefined()
      })
    })
    it('should fetch the newly deployed instances', async () => {
      const instances = Object.values(groupIdToInstances).flat()
      instances
        .filter(inst => !['ticket_field', 'user_field'].includes(inst.elemID.typeName))
        .forEach(instanceToAdd => {
          const instance = elements.find(e => e.elemID.isEqual(instanceToAdd.elemID))
          expect(instance).toBeDefined()
          expect((instance as InstanceElement).value).toMatchObject(instanceToAdd.value)
        })
    })
    it('should fetch ticket_field correctly', async () => {
      const instances = Object.values(groupIdToInstances).flat()
      instances
        .filter(inst => inst.elemID.typeName === 'ticket_field')
        .forEach(instanceToAdd => {
          const instance = elements
            .find(e => e.elemID.isEqual(instanceToAdd.elemID)) as InstanceElement
          expect(instance).toBeDefined()
          expect(
            _.omit(instance.value, ['custom_field_options', 'default_custom_field_option'])
          ).toMatchObject(
            _.omit(instanceToAdd.value, ['custom_field_options', 'default_custom_field_option'])
          )
          expect(instance.value.default_custom_field_option).toBeInstanceOf(ReferenceExpression)
          expect(instance.value.default_custom_field_option.elemID.getFullName())
            .toEqual(instanceToAdd.value.default_custom_field_option.elemID.getFullName())
          expect(instance.value.custom_field_options).toHaveLength(2);
          (instance.value.custom_field_options as Value[]).forEach((option, index) => {
            expect(option).toBeInstanceOf(ReferenceExpression)
            expect(option.elemID.getFullName())
              .toEqual(instanceToAdd.value.custom_field_options[index].elemID.getFullName())
          })
        })
    })
    it('should fetch user_field correctly', async () => {
      const instances = Object.values(groupIdToInstances).flat()
      instances
        .filter(inst => inst.elemID.typeName === 'user_field')
        .forEach(instanceToAdd => {
          const instance = elements
            .find(e => e.elemID.isEqual(instanceToAdd.elemID)) as InstanceElement
          expect(instance).toBeDefined()
          expect(
            _.omit(instance.value, ['custom_field_options'])
          ).toMatchObject(
            // We omit position since we add the user field to the order element
            _.omit(instanceToAdd.value, ['custom_field_options', 'position'])
          )
          expect(instance.value.custom_field_options).toHaveLength(2);
          (instance.value.custom_field_options as Value[]).forEach((option, index) => {
            expect(option).toBeInstanceOf(ReferenceExpression)
            expect(option.elemID.getFullName())
              .toEqual(instanceToAdd.value.custom_field_options[index].elemID.getFullName())
          })
          const userFieldsOrderInstance = elements
            .filter(e => e.elemID.typeName === 'user_field_order')
            .filter(isInstanceElement)
          expect(userFieldsOrderInstance).toHaveLength(1)
          const order = userFieldsOrderInstance[0]
          expect(order.value.active
            .map((ref: ReferenceExpression) => ref.elemID.getFullName()))
            .toContain(instance.elemID.getFullName())
        })
    })
    it('should fetch Guide instances and types', async () => {
      const typesToFetch = Object.keys(GUIDE_SUPPORTED_TYPES)
      const typeNames = elements.filter(isObjectType).map(e => e.elemID.typeName)
      const instances = elements.filter(isInstanceElement)
      typesToFetch.forEach(typeName => {
        expect(typeNames).toContain(typeName)
        const instance = instances.find(e => e.elemID.typeName === typeName)
        expect(instance).toBeDefined()
      })
    })
  })
})
