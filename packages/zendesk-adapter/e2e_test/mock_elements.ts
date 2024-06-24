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

export const mockDefaultValues: Record<string, Values> = {
  automation: {
    title: 'Test',
    active: true,
    actions: [
      {
        field: 'status',
        value: 'closed',
      },
    ],
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
          value: '120',
        },
      ],
    },
  },
  business_hours_schedule: {
    name: 'Test',
    time_zone: 'Central Time (US & Canada)',
    intervals: [
      {
        start_time: 1980,
        end_time: 2460,
      },
      {
        start_time: 3420,
        end_time: 3900,
      },
    ],
  },
  custom_role: {
    name: 'Test',
    description: 'Test custom role',
    configuration: {
      chat_access: true,
      manage_business_rules: true,
      manage_dynamic_content: true,
      manage_extensions_and_channels: true,
      manage_facebook: true,
      organization_editing: false,
      organization_notes_editing: false,
      ticket_deletion: true,
      view_deleted_tickets: true,
      ticket_tag_editing: true,
      twitter_search_access: false,
      forum_access_restricted_content: false,
      end_user_list_access: 'full',
      ticket_access: 'all',
      ticket_comment_access: 'public',
      voice_access: true,
      moderate_forums: false,
      group_access: false, // must be false - see SALTO-4041
      light_agent: false,
      side_conversation_create: true,
      assign_tickets_to_any_group: true,
      end_user_profile_access: 'full',
      explore_access: 'full',
      forum_access: 'full',
      macro_access: 'full',
      report_access: 'full',
      ticket_editing: true,
      ticket_merge: true,
      view_access: 'full',
      user_view_access: 'full',
      voice_dashboard_access: true,
      // must be false - see SALTO-3257
      manage_contextual_workspaces: false,
      manage_organization_fields: false,
      manage_ticket_fields: false,
      manage_ticket_forms: false,
      manage_user_fields: false,
    },
  },
  group: {
    name: 'Test',
    description: 'Test',
    default: false,
    deleted: false,
  },
  macro: {
    title: 'Test',
    active: true,
    actions: [
      {
        field: 'group_id',
        value: 'current_groups',
      },
      {
        field: 'assignee_id',
        value: 'current_user',
      },
    ],
  },
  sla_policy: {
    title: 'Test',
    filter: {
      all: [
        {
          field: 'assignee_id',
          operator: 'is',
          value: 'requester_id',
        },
      ],
    },
    policy_metrics: [
      {
        priority: 'low',
        metric: 'periodic_update_time',
        target: 1200,
        business_hours: false,
      },
      {
        priority: 'normal',
        metric: 'periodic_update_time',
        target: 600,
        business_hours: false,
      },
      {
        priority: 'high',
        metric: 'periodic_update_time',
        target: 300,
        business_hours: false,
      },
      {
        priority: 'urgent',
        metric: 'periodic_update_time',
        target: 300,
        business_hours: false,
      },
    ],
  },
  view: {
    title: 'Test',
    active: true,
    description: 'Test view',
    execution: {
      group_by: 'submitter',
      group_order: 'desc',
      sort_order: 'desc',
      group: {
        id: 'submitter',
        title: 'Submitter',
        order: 'desc',
      },
      columns: [
        {
          id: 'satisfaction_score',
          title: 'Satisfaction',
        },
        {
          id: 'subject',
          title: 'Subject',
        },
      ],
      fields: [
        {
          id: 'satisfaction_score',
          title: 'Satisfaction',
        },
        {
          id: 'subject',
          title: 'Subject',
        },
      ],
    },
    conditions: {
      all: [
        {
          field: 'type',
          operator: 'is',
          value: 'problem',
        },
      ],
      any: [
        {
          field: 'requester_id',
          operator: 'is_not',
          value: 'assignee_id',
        },
      ],
    },
  },
  ticket_field: {
    type: 'tagger',
    raw_title: 'Test',
    raw_description: '',
    active: true,
    required: false,
    collapsed_for_agents: false,
    visible_in_portal: false,
    editable_in_portal: false,
    required_in_portal: false,
    removable: true,
  },
  user_field: {
    type: 'dropdown',
    raw_title: 'Test',
    key: 'Test',
    raw_description: '',
    position: 9999,
    active: true,
    system: false,
  },
}
