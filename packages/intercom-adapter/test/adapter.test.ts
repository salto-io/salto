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
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { InstanceElement, isInstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { credentialsType } from '../src/auth'
import { DEFAULT_CONFIG } from '../src/config'
import fetchMockReplies from './fetch_mock_replies.json'

type MockReply = {
  url: string
  method: definitions.HTTPMethod
  params?: Record<string, string>
  response: unknown
}

describe('Intercom adapter', () => {
  jest.setTimeout(10 * 1000)
  let mockAxiosAdapter: MockAdapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockAxiosAdapter.onGet('/me').reply(200, { app: { id_code: '123' } })
    ;([...fetchMockReplies] as MockReply[]).forEach(({ url, params, response }) => {
      const mock = mockAxiosAdapter.onGet.bind(mockAxiosAdapter)
      const handler = mock(url, !_.isEmpty(params) ? { params } : undefined)
      handler.replyOnce(200, response)
    })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
    jest.clearAllMocks()
  })

  describe('fetch', () => {
    describe('full', () => {
      it('should generate the right elements on fetch', async () => {
        expect(adapter.configType).toBeDefined()
        const { elements } = await adapter
          .operations({
            credentials: new InstanceElement('config', credentialsType, {
              accessToken: 'fakeAccessToken',
            }),
            config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: { reportProgress: () => null } })

        expect([...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()).toEqual([
          'article',
          'collection',
          'data_attribute',
          'help_center',
          'news_item',
          'newsfeed',
          'segment',
          'subscription_type',
          'subscription_type_translation',
          'tag',
          'team',
          'ticket_type',
          'ticket_type_attribute',
        ])
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'intercom.article',
          'intercom.article.instance.Test_collection_This_is_a_test_article@sussss',
          'intercom.collection',
          'intercom.collection.instance.Test_collection@s',
          'intercom.data_attribute',
          'intercom.data_attribute.instance.name',
          'intercom.help_center',
          'intercom.help_center.instance.test_help_center@b',
          'intercom.news_item',
          'intercom.news_item.instance.This_is_a_test_news_item@s',
          'intercom.newsfeed',
          'intercom.newsfeed.instance.Test',
          'intercom.newsfeed.instance.Test_with_a_long_name@s',
          'intercom.segment',
          'intercom.segment.instance.Active',
          'intercom.segment.instance.Customers',
          'intercom.subscription_type',
          'intercom.subscription_type.instance.opt_out_Announcements',
          'intercom.subscription_type.instance.opt_out_Best_practices@uus',
          'intercom.subscription_type.instance.opt_out_Newsletter',
          'intercom.subscription_type_translation',
          'intercom.subscription_type_translation.instance.Announcements',
          'intercom.subscription_type_translation.instance.Best_practices@s',
          'intercom.subscription_type_translation.instance.Newsletter',
          'intercom.tag',
          'intercom.tag.instance.Another_test_tag@s',
          'intercom.tag.instance.Test_tag@s',
          'intercom.tag.instance.Test_tag_with_a_long_name@s',
          'intercom.team',
          'intercom.team.instance.Billing',
          'intercom.team.instance.Free',
          'intercom.ticket_type',
          'intercom.ticket_type.instance.Customer_Request@s',
          'intercom.ticket_type.instance.Feature_Request@s',
          'intercom.ticket_type.instance.Tracker_Tickets@s',
          'intercom.ticket_type_attribute',
          'intercom.ticket_type_attribute.instance.Customer_Request__default_description_@suuuu',
          'intercom.ticket_type_attribute.instance.Customer_Request__default_title_@suuuu',
          'intercom.ticket_type_attribute.instance.Feature_Request__default_description_@suuuu',
          'intercom.ticket_type_attribute.instance.Feature_Request__default_title_@suuuu',
          'intercom.ticket_type_attribute.instance.Tracker_Tickets__default_description_@suuuu',
          'intercom.ticket_type_attribute.instance.Tracker_Tickets__default_title_@suuuu',
          'intercom.ticket_type_attribute__input_options',
        ])

        // Specific instances:
        const instances = elements.filter(isInstanceElement)

        // Article
        const article = instances.find(
          e => e.elemID.getFullName() === 'intercom.article.instance.Test_collection_This_is_a_test_article@sussss',
        )
        expect(article?.value).toEqual(
          expect.objectContaining({
            type: 'article',
            parent_type: 'collection',
            title: 'This is a test article',
            description: '',
            body: '<p class="no-margin">Hello, I\'m an article for example. You can edit me in the admin panel.</p>',
            author_id: 5230119,
            state: 'published',
            url: 'https://help.test.io/',
          }),
        )
        expect(article?.value?.parent_id).toBeInstanceOf(ReferenceExpression)
        expect(article?.value?.parent_id?.elemID.getFullName()).toEqual(
          'intercom.collection.instance.Test_collection@s',
        )

        // Collection
        const collection = instances.find(
          e => e.elemID.getFullName() === 'intercom.collection.instance.Test_collection@s',
        )
        expect(collection?.value).toEqual(
          expect.objectContaining({
            name: 'Test collection',
            url: 'https://test.io/',
            order: 1,
            description: 'This is a test collection',
            icon: 'book-bookmark',
          }),
        )
        expect(collection?.value?.help_center_id).toBeInstanceOf(ReferenceExpression)
        expect(collection?.value?.help_center_id?.elemID.getFullName()).toEqual(
          'intercom.help_center.instance.test_help_center@b',
        )

        // Data Attribute
        const dataAttribute = instances.find(e => e.elemID.getFullName() === 'intercom.data_attribute.instance.name')
        expect(dataAttribute?.value).toEqual(
          expect.objectContaining({
            type: 'data_attribute',
            name: 'name',
            full_name: 'name',
            label: 'Name',
            description: "A person's full name",
            data_type: 'string',
            api_writable: true,
            ui_writable: true,
            messenger_writable: true,
            custom: false,
            archived: false,
            model: 'contact',
          }),
        )

        // Help Center
        const helpCenter = instances.find(
          e => e.elemID.getFullName() === 'intercom.help_center.instance.test_help_center@b',
        )
        expect(helpCenter?.value).toEqual(
          expect.objectContaining({
            identifier: 'test-help-center',
            website_turned_on: true,
            display_name: 'Test Help Center',
          }),
        )

        // News Item
        const newsItem = instances.find(
          e => e.elemID.getFullName() === 'intercom.news_item.instance.This_is_a_test_news_item@s',
        )
        expect(newsItem?.value).toEqual(
          expect.objectContaining({
            type: 'news-item',
            title: 'This is a test news item',
            body: "<p>Hi there,</p><p>This is a test news item. It's a great way to communicate with your users.</p>",
            sender_id: 5451387,
            state: 'live',
            labels: ['Announcement'],
            reactions: ['💜', '😴', '👎', '🎉'],
            deliver_silently: false,
          }),
        )
        expect(newsItem?.value?.newsfeed_assignments.map((e: ReferenceExpression) => e.elemID.getFullName())).toEqual([
          'intercom.newsfeed.instance.Test_with_a_long_name@s',
          'intercom.newsfeed.instance.Test',
        ])

        // Newsfeed
        const newsfeed = instances.find(e => e.elemID.getFullName() === 'intercom.newsfeed.instance.Test')
        expect(newsfeed?.value).toEqual(
          expect.objectContaining({
            type: 'newsfeed',
            name: 'Test',
          }),
        )

        // Segment
        const segment = instances.find(e => e.elemID.getFullName() === 'intercom.segment.instance.Active')
        expect(segment?.value).toEqual(
          expect.objectContaining({
            type: 'segment',
            name: 'Active',
            person_type: 'user',
          }),
        )

        // Subscription Type
        const subscriptionType = instances.find(
          e => e.elemID.getFullName() === 'intercom.subscription_type.instance.opt_out_Announcements',
        )
        expect(subscriptionType?.value).toEqual(
          expect.objectContaining({
            type: 'subscription',
            state: 'draft',
            consent_type: 'opt_out',
            content_types: ['email'],
          }),
        )
        expect(subscriptionType?.value?.default_translation).toBeInstanceOf(ReferenceExpression)
        expect(subscriptionType?.value?.default_translation?.elemID.getFullName()).toEqual(
          'intercom.subscription_type_translation.instance.Announcements',
        )
        expect(subscriptionType?.value?.translations.map((e: ReferenceExpression) => e.elemID.getFullName())).toEqual([
          'intercom.subscription_type_translation.instance.Announcements',
        ])

        // Subscription Type Translation
        const subscriptionTypeTranslation = instances.find(
          e => e.elemID.getFullName() === 'intercom.subscription_type_translation.instance.Announcements',
        )
        expect(subscriptionTypeTranslation?.value).toEqual(
          expect.objectContaining({
            name: 'Announcements',
            description: 'Offers, product and feature announcements',
            locale: 'en',
          }),
        )

        // Tag
        const tag = instances.find(e => e.elemID.getFullName() === 'intercom.tag.instance.Test_tag@s')
        expect(tag?.value).toEqual(
          expect.objectContaining({
            type: 'tag',
            name: 'Test tag',
          }),
        )

        // Team
        const team = instances.find(e => e.elemID.getFullName() === 'intercom.team.instance.Billing')
        expect(team?.value).toEqual(
          expect.objectContaining({
            type: 'team',
            name: 'Billing',
            admin_ids: [5451387, 5230119, 4361488, 4554691],
          }),
        )

        // Ticket Type
        const ticketType = instances.find(
          e => e.elemID.getFullName() === 'intercom.ticket_type.instance.Customer_Request@s',
        )
        expect(ticketType?.value).toEqual(
          expect.objectContaining({
            name: 'Customer Request',
            description: '',
            icon: '✨',
            archived: false,
            is_internal: false,
          }),
        )
        expect(
          ticketType?.value?.ticket_type_attributes.map((e: ReferenceExpression) => e.elemID.getFullName()),
        ).toEqual([
          'intercom.ticket_type_attribute.instance.Customer_Request__default_title_@suuuu',
          'intercom.ticket_type_attribute.instance.Customer_Request__default_description_@suuuu',
        ])

        // Ticket Type Attribute
        const ticketTypeAttribute = instances.find(
          e =>
            e.elemID.getFullName() === 'intercom.ticket_type_attribute.instance.Feature_Request__default_title_@suuuu',
        )
        expect(ticketTypeAttribute?.value).toEqual(
          expect.objectContaining({
            name: '_default_title_',
            description: '',
            data_type: 'string',
            input_options: {
              multiline: false,
            },
            order: 0,
            required_to_create: false,
            required_to_create_for_contacts: false,
            visible_on_create: true,
            visible_to_contacts: true,
            default: true,
            archived: false,
          }),
        )
        expect(ticketTypeAttribute?.value?.ticket_type_id).toBeInstanceOf(ReferenceExpression)
        expect(ticketTypeAttribute?.value?.ticket_type_id?.elemID.getFullName()).toEqual(
          'intercom.ticket_type.instance.Feature_Request@s',
        )
      })
    })
  })
})
