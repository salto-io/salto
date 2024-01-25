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

export const mockThemeManifest = (name: string): string => `{
  "name": "${name}",
  "author": "Zendesk",
  "version": "3.1.2",
  "api_version": 3,
  "default_locale": "en-us",
  "settings": [
    {
      "label": "colors_group_label",
      "variables": [
        {
          "identifier": "brand_color",
          "type": "color",
          "description": "brand_color_description",
          "label": "brand_color_label",
          "value": "#17494D"
        },
        {
          "identifier": "brand_text_color",
          "type": "color",
          "description": "brand_text_color_description",
          "label": "brand_text_color_label",
          "value": "#FFFFFF"
        },
        {
          "identifier": "text_color",
          "type": "color",
          "description": "text_color_description",
          "label": "text_color_label",
          "value": "#2F3941"
        },
        {
          "identifier": "link_color",
          "type": "color",
          "description": "link_color_description",
          "label": "link_color_label",
          "value": "#1F73B7"
        },
        {
          "identifier": "hover_link_color",
          "type": "color",
          "description": "hover_link_color_description",
          "label": "hover_link_color_label",
          "value": "#0F3554"
        },
        {
          "identifier": "visited_link_color",
          "type": "color",
          "description": "visited_link_color_description",
          "label": "visited_link_color_label",
          "value": "#9358B0"
        },
        {
          "identifier": "background_color",
          "type": "color",
          "description": "background_color_description",
          "label": "background_color_label",
          "value": "#FFFFFF"
        }
      ]
    },
    {
      "label": "fonts_group_label",
      "variables": [
        {
          "identifier": "heading_font",
          "type": "list",
          "description": "heading_font_description",
          "label": "heading_font_label",
          "value": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          "options": [
            {
              "label": "System",
              "value": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
            },
            {
              "label": "Arial",
              "value": "Arial, 'Helvetica Neue', Helvetica, sans-serif"
            },
            {
              "label": "Arial Black",
              "value": "'Arial Black', Arial, 'Helvetica Neue', Helvetica, sans-serif"
            },
            {
              "label": "Baskerville",
              "value": "Baskerville, 'Times New Roman', Times, serif"
            },
            {
              "label": "Century Gothic",
              "value": "'Century Gothic', sans-serif"
            },
            {
              "label": "Copperplate Light",
              "value": "'Copperplate Light', 'Copperplate Gothic Light', serif"
            },
            {
              "label": "Courier New",
              "value": "'Courier New', Courier, monospace"
            },
            {
              "label": "Futura",
              "value": "Futura, 'Century Gothic', sans-serif"
            },
            {
              "label": "Garamond",
              "value": "Garamond, 'Hoefler Text', 'Times New Roman', Times, serif"
            },
            {
              "label": "Geneva",
              "value": "Geneva, 'Lucida Sans', 'Lucida Grande', 'Lucida Sans Unicode', Verdana, sans-serif"
            },
            {
              "label": "Georgia",
              "value": "Georgia, Palatino, 'Palatino Linotype', Times, 'Times New Roman', serif"
            },
            {
              "label": "Helvetica",
              "value": "Helvetica, Arial, sans-serif"
            },
            {
              "label": "Helvetica Neue",
              "value": "'Helvetica Neue', Arial, Helvetica, sans-serif"
            },
            {
              "label": "Impact",
              "value": "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif"
            },
            {
              "label": "Lucida Grande",
              "value": "'Lucida Grande', 'Lucida Sans', 'Lucida Sans Unicode', sans-serif"
            },
            {
              "label": "Trebuchet MS",
              "value": "'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', 'Lucida Sans', Arial, sans-serif"
            }
          ]
        },
        {
          "identifier": "text_font",
          "type": "list",
          "description": "text_font_description",
          "label": "text_font_label",
          "value": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          "options": [
            {
              "label": "System",
              "value": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
            },
            {
              "label": "Arial",
              "value": "Arial, 'Helvetica Neue', Helvetica, sans-serif"
            },
            {
              "label": "Arial Black",
              "value": "'Arial Black', Arial, 'Helvetica Neue', Helvetica, sans-serif"
            },
            {
              "label": "Baskerville",
              "value": "Baskerville, 'Times New Roman', Times, serif"
            },
            {
              "label": "Century Gothic",
              "value": "'Century Gothic', sans-serif"
            },
            {
              "label": "Copperplate Light",
              "value": "'Copperplate Light', 'Copperplate Gothic Light', serif"
            },
            {
              "label": "Courier New",
              "value": "'Courier New', Courier, monospace"
            },
            {
              "label": "Futura",
              "value": "Futura, 'Century Gothic', sans-serif"
            },
            {
              "label": "Garamond",
              "value": "Garamond, 'Hoefler Text', 'Times New Roman', Times, serif"
            },
            {
              "label": "Geneva",
              "value": "Geneva, 'Lucida Sans', 'Lucida Grande', 'Lucida Sans Unicode', Verdana, sans-serif"
            },
            {
              "label": "Georgia",
              "value": "Georgia, Palatino, 'Palatino Linotype', Times, 'Times New Roman', serif"
            },
            {
              "label": "Helvetica",
              "value": "Helvetica, Arial, sans-serif"
            },
            {
              "label": "Helvetica Neue",
              "value": "'Helvetica Neue', Arial, Helvetica, sans-serif"
            },
            {
              "label": "Impact",
              "value": "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif"
            },
            {
              "label": "Lucida Grande",
              "value": "'Lucida Grande', 'Lucida Sans', 'Lucida Sans Unicode', sans-serif"
            },
            {
              "label": "Trebuchet MS",
              "value": "'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', 'Lucida Sans', Arial, sans-serif"
            }
          ]
        }
      ]
    },
    {
      "label": "brand_group_label",
      "variables": [
        {
          "identifier": "logo",
          "type": "file",
          "description": "logo_description",
          "label": "logo_label"
        },
        {
          "identifier": "show_brand_name",
          "type": "checkbox",
          "description": "show_brand_name_description",
          "label": "show_brand_name_label",
          "value": true
        },
        {
          "identifier": "favicon",
          "type": "file",
          "description": "favicon_description",
          "label": "favicon_label"
        }
      ]
    },
    {
      "label": "images_group_label",
      "variables": [
        {
          "identifier": "homepage_background_image",
          "type": "file",
          "description": "homepage_background_image_description",
          "label": "homepage_background_image_label"
        },
        {
          "identifier": "community_background_image",
          "type": "file",
          "description": "community_background_image_description",
          "label": "community_background_image_label"
        },
        {
          "identifier": "community_image",
          "type": "file",
          "description": "community_image_description",
          "label": "community_image_label"
        }
      ]
    },
    {
      "label": "search_group_label",
      "variables": [
        {
          "identifier": "instant_search",
          "type": "checkbox",
          "description": "instant_search_description",
          "label": "instant_search_label",
          "value": true
        },
        {
          "identifier": "scoped_kb_search",
          "type": "checkbox",
          "description": "scoped_knowledge_base_search_description",
          "label": "scoped_knowledge_base_search_label",
          "value": true
        },
        {
          "identifier": "scoped_community_search",
          "type": "checkbox",
          "description": "scoped_community_search_description",
          "label": "scoped_community_search_label",
          "value": true
        }
      ]
    },
    {
      "label": "home_page_group_label",
      "variables": [
        {
          "identifier": "show_recent_activity",
          "type": "checkbox",
          "description": "recent_activity_description",
          "label": "recent_activity_label",
          "value": true
        }
      ]
    },
    {
      "label": "article_page_group_label",
      "variables": [
        {
          "identifier": "show_articles_in_section",
          "type": "checkbox",
          "description": "articles_in_section_description",
          "label": "articles_in_section_label",
          "value": true
        },
        {
          "identifier": "show_article_author",
          "type": "checkbox",
          "description": "article_author_description",
          "label": "article_author_label",
          "value": true
        },
        {
          "identifier": "show_article_comments",
          "type": "checkbox",
          "description": "article_comments_description",
          "label": "article_comments_label",
          "value": true
        },
        {
          "identifier": "show_follow_article",
          "type": "checkbox",
          "description": "follow_article_description",
          "label": "follow_article_label",
          "value": true
        },
        {
          "identifier": "show_recently_viewed_articles",
          "type": "checkbox",
          "description": "recently_viewed_articles_description",
          "label": "recently_viewed_articles_label",
          "value": true
        },
        {
          "identifier": "show_related_articles",
          "type": "checkbox",
          "description": "related_articles_description",
          "label": "related_articles_label",
          "value": true
        },
        {
          "identifier": "show_article_sharing",
          "type": "checkbox",
          "description": "article_sharing_description",
          "label": "article_sharing_label",
          "value": true
        }
      ]
    },
    {
      "label": "section_page_group_label",
      "variables": [
        {
          "identifier": "show_follow_section",
          "type": "checkbox",
          "description": "follow_section_description",
          "label": "follow_section_label",
          "value": true
        }
      ]
    },
    {
      "label": "community_post_group_label",
      "variables": [
        {
          "identifier": "show_follow_post",
          "type": "checkbox",
          "description": "follow_post_description",
          "label": "follow_post_label",
          "value": true
        },
        {
          "identifier": "show_post_sharing",
          "type": "checkbox",
          "description": "post_sharing_description",
          "label": "post_sharing_label",
          "value": true
        }
      ]
    },
    {
      "label": "community_topic_group_label",
      "variables": [
        {
          "identifier": "show_follow_topic",
          "type": "checkbox",
          "description": "follow_topic_description",
          "label": "follow_topic_label",
          "value": true
        }
      ]
    },
    {
      "label": "request_list_group_label",
      "variables": [
        {
          "identifier": "request_list_beta",
          "type": "checkbox",
          "description": "request_list_beta_description",
          "label": "request_list_beta_label",
          "value": false
        }
      ]
    }
  ]
}`
