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

describe('adapter', () => {
  jest.setTimeout(10 * 1000)
  let mockAxiosAdapter: MockAdapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockAxiosAdapter.onGet('/me').reply(200)
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
          'intercom.article.instance.Getting_Started_Fetching_Your_Configuration_Data@susss',
          'intercom.collection',
          'intercom.collection.instance.Getting_Started@s',
          'intercom.data_attribute',
          'intercom.data_attribute.instance.name',
          'intercom.help_center',
          'intercom.help_center.instance.salto_io@b',
          'intercom.news_item',
          'intercom.news_item.instance.Monitoring_has_a_new_home_@ssssl',
          'intercom.newsfeed',
          'intercom.newsfeed.instance.Jira',
          'intercom.newsfeed.instance.Rest_of_the_adapters@s',
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
          'intercom.tag.instance.Free_plan@s',
          'intercom.tag.instance.enterprise_paying@s',
          'intercom.tag.instance.enterprise_trials@s',
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
          e =>
            e.elemID.getFullName() ===
            'intercom.article.instance.Getting_Started_Fetching_Your_Configuration_Data@susss',
        )
        expect(article?.value).toEqual(
          expect.objectContaining({
            parent_type: 'collection',
            title: 'Fetching Your Configuration Data',
            description: '',
            body: '<p class="no-margin">Hello, I\'m an article for example. You can learn how to explore your configuration data here: <a href="https://help.salto.io/en/articles/6926919-exploring-your-configuration-data" target="_blank" class="intercom-content-link">here</a>).</p>',
            author_id: 5230119,
            state: 'published',
            url: 'https://help.salto.io/en/articles/8889642-fetching-your-configuration-data',
          }),
        )
        expect(article?.value?.parent_id).toBeInstanceOf(ReferenceExpression)
        expect(article?.value?.parent_id?.elemID.getFullName()).toEqual(
          'intercom.collection.instance.Getting_Started@s',
        )

        // Collection
        const collection = instances.find(
          e => e.elemID.getFullName() === 'intercom.collection.instance.Getting_Started@s',
        )
        expect(collection?.value).toEqual(
          expect.objectContaining({
            name: 'Getting Started',
            url: 'https://help.salto.io/',
            order: 1,
            description:
              'This collection will help you get started with Salto. See everything you need to know to get you up and running in a jiffy.',
            icon: 'book-bookmark',
          }),
        )
        expect(collection?.value?.help_center_id).toBeInstanceOf(ReferenceExpression)
        expect(collection?.value?.help_center_id?.elemID.getFullName()).toEqual(
          'intercom.help_center.instance.salto_io@b',
        )

        // Data Attribute
        const dataAttribute = instances.find(e => e.elemID.getFullName() === 'intercom.data_attribute.instance.name')
        expect(dataAttribute?.value).toEqual(
          expect.objectContaining({
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
        const helpCenter = instances.find(e => e.elemID.getFullName() === 'intercom.help_center.instance.salto_io@b')
        expect(helpCenter?.value).toEqual(
          expect.objectContaining({
            identifier: 'salto-io',
            website_turned_on: true,
            display_name: 'Salto Help Center',
          }),
        )

        // News Item
        const newsItem = instances.find(
          e => e.elemID.getFullName() === 'intercom.news_item.instance.Monitoring_has_a_new_home_@ssssl',
        )
        expect(newsItem?.value).toEqual(
          expect.objectContaining({
            title: 'Monitoring has a new home!',
            body: "<p>Hi there,</p><p>The Monitoring feature, previously located in the environment's top bar, is now accessible directly from the environment Settings tab.  This change is part of our ongoing effort to make your navigation within Salto more intuitive and efficient.</p>",
            sender_id: 5451387,
            state: 'live',
            labels: ['Announcement'],
            reactions: ['💜', '😴', '👎', '🎉'],
            deliver_silently: false,
          }),
        )
        expect(newsItem?.value?.newsfeed_assignments.map((e: ReferenceExpression) => e.elemID.getFullName())).toEqual([
          'intercom.newsfeed.instance.Rest_of_the_adapters@s',
          'intercom.newsfeed.instance.Jira',
        ])

        // Newsfeed
        const newsfeed = instances.find(e => e.elemID.getFullName() === 'intercom.newsfeed.instance.Jira')
        expect(newsfeed?.value).toEqual(
          expect.objectContaining({
            name: 'Jira',
          }),
        )

        // Segment
        const segment = instances.find(e => e.elemID.getFullName() === 'intercom.segment.instance.Active')
        expect(segment?.value).toEqual(
          expect.objectContaining({
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
        const tag = instances.find(e => e.elemID.getFullName() === 'intercom.tag.instance.Free_plan@s')
        expect(tag?.value).toEqual(
          expect.objectContaining({
            name: 'Free plan',
          }),
        )

        // Team
        const team = instances.find(e => e.elemID.getFullName() === 'intercom.team.instance.Billing')
        expect(team?.value).toEqual(
          expect.objectContaining({
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
