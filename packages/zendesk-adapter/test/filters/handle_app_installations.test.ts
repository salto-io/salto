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

import { filterUtils } from '@salto-io/adapter-components'
import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  MapType,
  ObjectType,
  ReferenceExpression,
  TemplateExpression,
  toChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import ZendeskClient from '../../src/client/client'
import filterCreator from '../../src/filters/handle_app_installations'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import { ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'

describe('handle app installations filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
  let filter: FilterType

  beforeAll(() => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'c' },
    })
  })

  const appType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'app_installation'),
    fields: {
      settings: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  const ticketFieldType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'ticket_field'),
  })

  const fieldOptionType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'ticket_field__custom_field_options'),
  })

  const groupType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'group'),
  })

  const field1 = new InstanceElement('field1', ticketFieldType, { id: 1451000000 })
  const field2 = new InstanceElement('field2', ticketFieldType, { id: 1452000000 })
  const option1 = new InstanceElement('option1', fieldOptionType, { id: 1351000000 })
  const option2 = new InstanceElement('option2', fieldOptionType, { id: 1352000000 })
  const group1 = new InstanceElement('group1', groupType, { id: 1251000000 })
  const group2 = new InstanceElement('group2', groupType, { id: 1252000000 })

  let app: InstanceElement

  const generateApp = (): InstanceElement =>
    new InstanceElement('appOne', appType, {
      settings: {
        unmappedF: '1452000000',
        unmappedFO: '1352000000',
        unmappedG: '1252000000',
        mapped_field: '1451000000',
        nonExistent_field: '1444000000',
        mapped_fields: 'before1451000000, 1452000000after',
        ticketFieldMapped: '1451000000',
        mapped_options: 'custom_field_1351000000,custom_field_1352000000',
        oneMapped_options: 'custom_field_1351000000',
        nonExistant_options: 'custom_field_1333000000',
        mappedGroup: '1251000000',
        nonExistantGroup: '1222000000',
        mappedWithNewlineSeparatorGroups: `
before1251000000
1252000000
after
`,
      },
    })
  beforeEach(async () => {
    app = generateApp()
  })

  const SUPPORTING_ELEMENTS = [
    appType,
    ticketFieldType,
    fieldOptionType,
    groupType,
    field1,
    field2,
    option1,
    option2,
    group1,
    group2,
  ]

  const initFilterAndFetch = async (config = DEFAULT_CONFIG): Promise<void> => {
    filter = filterCreator(createFilterCreatorParams({ client, config })) as FilterType
    await filter.onFetch([app, ...SUPPORTING_ELEMENTS])
  }

  describe('onFetch', () => {
    it('Should not map fields with unmapped field names', async () => {
      await initFilterAndFetch()
      expect(app.value.settings.unmappedF).toEqual('1452000000')
      expect(app.value.settings.unmappedFO).toEqual('1352000000')
      expect(app.value.settings.unmappedG).toEqual('1252000000')
    })

    it('Should not map undetected ids', async () => {
      await initFilterAndFetch()
      expect(app.value.settings.nonExistantGroup).toEqual('1222000000')
      expect(app.value.settings.nonExistant_options).toEqual('custom_field_1333000000')
      expect(app.value.settings.nonExistent_field).toEqual('1444000000')
    })

    it('Should map single id fields', async () => {
      await initFilterAndFetch()
      expect(app.value.settings.mapped_field).toEqual(
        new TemplateExpression({
          parts: [new ReferenceExpression(field1.elemID, field1)],
        }),
      )
      expect(app.value.settings.ticketFieldMapped).toEqual(
        new TemplateExpression({
          parts: [new ReferenceExpression(field1.elemID, field1)],
        }),
      )
      expect(app.value.settings.oneMapped_options).toEqual(
        new TemplateExpression({
          parts: ['custom_field_', new ReferenceExpression(option1.elemID, option1)],
        }),
      )
      expect(app.value.settings.mappedGroup).toEqual(
        new TemplateExpression({
          parts: [new ReferenceExpression(group1.elemID, group1)],
        }),
      )
    })

    it('Should map comma separated fields', async () => {
      await initFilterAndFetch()
      expect(app.value.settings.mapped_fields).toEqual(
        new TemplateExpression({
          parts: [
            'before',
            new ReferenceExpression(field1.elemID, field1),
            ', ',
            new ReferenceExpression(field2.elemID, field2),
            'after',
          ],
        }),
      )
      expect(app.value.settings.mapped_options).toEqual(
        new TemplateExpression({
          parts: [
            'custom_field_',
            new ReferenceExpression(option1.elemID, option1),
            ',custom_field_',
            new ReferenceExpression(option2.elemID, option2),
          ],
        }),
      )
    })

    it('Should map newline separated fields', async () => {
      await initFilterAndFetch()
      expect(app.value.settings.mappedWithNewlineSeparatorGroups).toEqual(
        new TemplateExpression({
          parts: [
            '\nbefore',
            new ReferenceExpression(group1.elemID, group1),
            '\n',
            new ReferenceExpression(group2.elemID, group2),
            '\nafter\n',
          ],
        }),
      )
    })

    it('should map all fields with greedy applied', async () => {
      const confCopy = _.cloneDeep(DEFAULT_CONFIG)
      confCopy[FETCH_CONFIG].greedyAppReferences = true
      await initFilterAndFetch(confCopy)
      expect(app.value.settings.unmappedF).toEqual(
        new TemplateExpression({
          parts: [new ReferenceExpression(field2.elemID, field2)],
        }),
      )
      expect(app.value.settings.unmappedFO).toEqual(
        new TemplateExpression({
          parts: [new ReferenceExpression(option2.elemID, option2)],
        }),
      )
      expect(app.value.settings.unmappedG).toEqual(
        new TemplateExpression({
          parts: [new ReferenceExpression(group2.elemID, group2)],
        }),
      )
    })
  })

  describe('preDeploy', () => {
    it('should return template values to original state', async () => {
      await initFilterAndFetch()
      const appClone = app.clone()
      const cleanApp = generateApp()
      expect(appClone).not.toEqual(cleanApp)
      await filter.preDeploy([toChange({ before: appClone, after: appClone })])
      expect(appClone).toEqual(cleanApp)
    })
  })

  describe('onDeploy', () => {
    it('should return template values to onFetch status', async () => {
      await initFilterAndFetch()
      const appClone = app.clone()
      await filter.preDeploy([toChange({ before: appClone, after: appClone })])
      await filter.onDeploy([toChange({ before: appClone, after: appClone })])
      expect(appClone).toEqual(app)
    })
  })
})
