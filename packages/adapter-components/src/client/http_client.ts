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
import { ResponseType } from 'axios'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import {
  Connection,
  ConnectionCreator,
  createRetryOptions,
  createClientConnection,
  ResponseValue,
  Response,
} from './http_connection'
import { AdapterClientBase } from './base'
import {
  ClientRetryConfig,
  ClientRateLimitConfig,
  ClientPageSizeConfig,
  ClientBaseConfig,
  ClientTimeoutConfig,
} from '../definitions/user/client_config'
import { requiresLogin, logDecorator } from './decorators'
import { throttle } from './rate_limit'

const log = logger(module)

const NO_TIMEOUT = 0
const dummy2 = {
  ticket_forms: [
    {
      id: 12494606333585,
      raw_name: 'Standardticketformular',
      raw_display_name: 'Standardticketformular',
      end_user_visible: true,
      position: 0,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 17108576907281,
        17058159889041, 19423517486097, 24729766128529, 24729862680593, 24729958180241, 24731656468497, 17938716420497,
        12494597108113, 12494577544849, 17055828700049, 16954390432913, 16954483020049, 16954534754577, 17797913489809,
        17797924765457, 17797916113937, 17069899344273, 25340008503313, 25339999262097, 17058615210001, 16955310159121,
        17114269301265, 17114297928337, 17058107579665, 19439745629969, 19687267064977, 19687260202641, 19687316508305,
        19513037635729, 17058642584593, 20604041987729, 18841597727889, 18841599244177, 18841598660113, 18024582907409,
        17058223706897, 23195259576849, 23699173960465, 24133997651473,
      ],
      active: true,
      default: true,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 16954390432913,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 16954483020049,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 16954483020049,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 16954534754577,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
            {
              id: 17797916113937,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17797913489809,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17797924765457,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 25340008503313,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 25339999262097,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/12494606333585.json',
      name: 'Standardticketformular',
      display_name: 'Standardticketformular',
      created_at: '2023-01-26T20:52:06Z',
      updated_at: '2024-06-14T12:18:37Z',
    },
    {
      id: 16893396544145,
      raw_name: 'KK::allgemeine Anfragen',
      raw_display_name: '',
      end_user_visible: false,
      position: 1,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 17108576907281,
        17058159889041, 19423517486097, 24729766128529, 24729862680593, 24729958180241, 24731656468497, 17938716420497,
        12494597108113, 12494577544849, 17055828700049, 16954390432913, 16954483020049, 16954534754577, 17797913489809,
        17797924765457, 17797916113937, 17069899344273, 25340008503313, 25339999262097, 17058615210001, 17057411767441,
        23076076221841, 17056089809169, 17056466973329, 17080213206801, 17056427535121, 17083502203537, 17083511576721,
        17056464101393, 17057390958993, 17099582070801, 17162023769489, 17058083681169, 16955310159121, 17114269301265,
        17114297928337, 19564102566801, 17058107579665, 19439745629969, 19687267064977, 19687260202641, 19687316508305,
        19513037635729, 18024582907409, 18841597727889, 18841598660113, 18841599244177, 17058642584593, 20604041987729,
        17058223706897, 23195259576849, 23699173960465, 24133997651473,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 16954390432913,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 16954483020049,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 16954483020049,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 16954534754577,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17797916113937,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17797924765457,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17797913489809,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_allgemein__dsgvo__datenschutzvorfall_meldung',
          child_fields: [
            {
              id: 17162023769489,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17056466973329,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17056464101393,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_allgemein__kopieanforderung',
          child_fields: [
            {
              id: 17056466973329,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17056089809169,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_allgemein__nicht_zuordenbar',
          child_fields: [
            {
              id: 17099582070801,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 25340008503313,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 25339999262097,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/16893396544145.json',
      name: 'KK::allgemeine Anfragen',
      display_name: '',
      created_at: '2023-07-11T09:23:26Z',
      updated_at: '2024-06-14T12:18:12Z',
    },
    {
      id: 16893476537745,
      raw_name: 'KK::Field Service Management',
      raw_display_name: '',
      end_user_visible: false,
      position: 2,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 17108576907281,
        17058159889041, 19423517486097, 24729766128529, 24729862680593, 24729958180241, 24731656468497, 17938716420497,
        12494597108113, 12494577544849, 17055828700049, 16954390432913, 16954483020049, 16954534754577, 17797913489809,
        17797924765457, 17797916113937, 17086178742033, 17086190109457, 17069899344273, 25340008503313, 25339999262097,
        17058615210001, 16955310159121, 17057411767441, 23076076221841, 20096414384401, 17056464101393, 17056466973329,
        17080213206801, 17056427535121, 17083502203537, 17083511576721, 17056089809169, 17070429186577, 17070454222993,
        17080405487121, 17080384737041, 17080429241617, 17081334153105, 17080464909841, 17162023769489, 17058083681169,
        17099582070801, 17114269301265, 17114297928337, 19564102566801, 19439745629969, 17058107579665, 18024582907409,
        18841597727889, 18841598660113, 18841599244177, 19687267064977, 19687260202641, 19687316508305, 19513037635729,
        17058642584593, 20604041987729, 17058223706897, 23195259576849, 23699173960465, 24133997651473,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 16954390432913,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 16954483020049,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 16954483020049,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 17797924765457,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 16954534754577,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
            {
              id: 17797913489809,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17797916113937,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 17086178742033,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 17086190109457,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__beauftragung__ablesung',
          child_fields: [
            {
              id: 20096414384401,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__beauftragung__geraetereklamation',
          child_fields: [
            {
              id: 20096414384401,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__beauftragung__geraetereklamation',
          child_fields: [
            {
              id: 20096414384401,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__schaden__schadensmeldung',
          child_fields: [
            {
              id: 20096414384401,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17070429186577,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17070454222993,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__beauftragung__neuaufnahme_lg_ne',
          child_fields: [
            {
              id: 20096414384401,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__schaden__schadenersatzansprueche',
          child_fields: [
            {
              id: 17056464101393,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17162023769489,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__schaden__schadenersatzansprueche',
          child_fields: [
            {
              id: 17162023769489,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17056464101393,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__beauftragung__mitteilung_kontaktdaten_mieter',
          child_fields: [
            {
              id: 17056464101393,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__auftrag__auftragsgrund',
          child_fields: [
            {
              id: 17056464101393,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__interne_rueckfrage__amm',
          child_fields: [
            {
              id: 17056464101393,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__beauftragung__warenversand',
          child_fields: [
            {
              id: 17080384737041,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17080429241617,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17080405487121,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17081334153105,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17080464909841,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__nicht_zuordenbar',
          child_fields: [
            {
              id: 17099582070801,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__beauftragung__geraeteaustausch',
          child_fields: [
            {
              id: 20096414384401,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__beauftragung__montage_demontage',
          child_fields: [
            {
              id: 20096414384401,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__beauftragung__funktionspruefung',
          child_fields: [
            {
              id: 20096414384401,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__beauftragung__montage_demontage',
          child_fields: [
            {
              id: 20096414384401,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__beauftragung__neuaufnahme',
          child_fields: [
            {
              id: 20096414384401,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__beauftragung__kostenanfrage_auftrag',
          child_fields: [
            {
              id: 20096414384401,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__beauftragung__kostenanfrage_auftrag',
          child_fields: [
            {
              id: 20096414384401,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__schaden__schadensmeldung',
          child_fields: [
            {
              id: 20096414384401,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__beauftragung__mitteilung_kontaktdaten_mieter',
          child_fields: [
            {
              id: 17056464101393,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__interne_rueckfrage__amm',
          child_fields: [
            {
              id: 17056464101393,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__rechnungswesen__stornobeleg',
          child_fields: [
            {
              id: 17056089809169,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__rechnungswesen__rechnungsreklamation',
          child_fields: [
            {
              id: 17056089809169,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17162023769489,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__nicht_zuordenbar_allgemein',
          child_fields: [
            {
              id: 17099582070801,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 25340008503313,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 25339999262097,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/16893476537745.json',
      name: 'KK::Field Service Management',
      display_name: '',
      created_at: '2023-07-11T09:25:05Z',
      updated_at: '2024-06-14T12:18:59Z',
    },
    {
      id: 16893489417745,
      raw_name: 'KK::Vertragsmanagement',
      raw_display_name: '',
      end_user_visible: false,
      position: 3,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 17108576907281,
        17058159889041, 19423517486097, 24729766128529, 24729862680593, 24729958180241, 24731656468497, 17938716420497,
        12494597108113, 12494577544849, 17055828700049, 16954390432913, 16954483020049, 16954534754577, 17797913489809,
        17797924765457, 17797916113937, 17069899344273, 25340008503313, 25339999262097, 17058615210001, 16955310159121,
        17057411767441, 23076076221841, 17083502203537, 17083511576721, 17058083681169, 17114269301265, 17114297928337,
        19564102566801, 17058107579665, 19439745629969, 18024582907409, 18841597727889, 18841598660113, 18841599244177,
        19687267064977, 19687260202641, 19687316508305, 19513037635729, 17058642584593, 20604041987729, 17058223706897,
        23195259576849, 23699173960465, 24133997651473,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 16954390432913,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 16954483020049,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 16954483020049,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 16954534754577,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
            {
              id: 17797913489809,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17797916113937,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17797924765457,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 25340008503313,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 25339999262097,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/16893489417745.json',
      name: 'KK::Vertragsmanagement',
      display_name: '',
      created_at: '2023-07-11T09:25:37Z',
      updated_at: '2024-06-14T12:19:18Z',
    },
    {
      id: 16893545805713,
      raw_name: 'KK::Abrechnungsservice',
      raw_display_name: '',
      end_user_visible: false,
      position: 4,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 17108576907281,
        17058159889041, 19423517486097, 24729766128529, 24729862680593, 24729958180241, 24731656468497, 17938716420497,
        12494597108113, 12494577544849, 17055828700049, 16954390432913, 16954483020049, 16954534754577, 17797913489809,
        17797924765457, 17797916113937, 17086178742033, 17086190109457, 17069899344273, 25340008503313, 25339999262097,
        17058615210001, 19826842578961, 19852692468497, 17056089809169, 16955310159121, 17057411767441, 23076076221841,
        17083502203537, 17083511576721, 19853906619281, 17056466973329, 17056427535121, 17099582070801, 17162023769489,
        17058083681169, 17114269301265, 17114297928337, 19564102566801, 17058107579665, 19439745629969, 18024582907409,
        18841597727889, 18841598660113, 18841599244177, 19687267064977, 19687260202641, 19687316508305, 19513037635729,
        17058642584593, 20604041987729, 17058223706897, 23195259576849, 23699173960465, 24133997651473,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 16954390432913,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 16954483020049,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17086178742033,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 17086190109457,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 16954483020049,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 16954534754577,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
            {
              id: 17797913489809,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17797916113937,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17797924765457,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_abre__korrektur__abrechnungskorrektur',
          child_fields: [
            {
              id: 19826842578961,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 19852692468497,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17162023769489,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_abre__schadenersatzanspruch__abrechnung',
          child_fields: [
            {
              id: 17162023769489,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17056089809169,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_abre__verbrauchswerte__schaetzung_beauftragung',
          child_fields: [
            {
              id: 17056466973329,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17056427535121,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_abre__korrektur__widerspruch_rechtsanwalt',
          child_fields: [
            {
              id: 17162023769489,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_abre__beauskunftung__schlussrechnung',
          child_fields: [
            {
              id: 17056089809169,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_abre__nicht_zuordenbar',
          child_fields: [
            {
              id: 17099582070801,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_abre__beauskunftung__schaetzung',
          child_fields: [
            {
              id: 17056466973329,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17056427535121,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_abre__verbrauchswerte__anforderung',
          child_fields: [
            {
              id: 17056466973329,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17056427535121,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_abre__verbrauchswerte__pruefung',
          child_fields: [
            {
              id: 17056466973329,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17056427535121,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 25340008503313,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 25339999262097,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/16893545805713.json',
      name: 'KK::Abrechnungsservice',
      display_name: '',
      created_at: '2023-07-11T09:26:38Z',
      updated_at: '2024-06-14T13:43:35Z',
    },
    {
      id: 16893568315665,
      raw_name: 'KK::Rechnungswesen',
      raw_display_name: '',
      end_user_visible: false,
      position: 5,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 17108576907281,
        17058159889041, 19423517486097, 24729766128529, 24729862680593, 24729958180241, 24731656468497, 17938716420497,
        12494597108113, 12494577544849, 17055828700049, 16954390432913, 16954483020049, 16954534754577, 17797913489809,
        17797924765457, 17797916113937, 17069899344273, 25340008503313, 25339999262097, 17058615210001, 16955310159121,
        17057411767441, 23076076221841, 17056089809169, 17055989454865, 17055974883345, 17057299687057, 17099582070801,
        17162023769489, 17058083681169, 17114269301265, 17114297928337, 19564102566801, 19439745629969, 17058107579665,
        19687267064977, 19687260202641, 19687316508305, 19513037635729, 18024582907409, 18841597727889, 18841598660113,
        18841599244177, 17058642584593, 20604041987729, 17058223706897, 23195259576849, 23699173960465, 24133997651473,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 16954390432913,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 16954483020049,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 16954483020049,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 17797924765457,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 16954534754577,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
            {
              id: 17797913489809,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17797916113937,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_rewe__rechnung__stornobeleg',
          child_fields: [
            {
              id: 17056089809169,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_rewe__rechnung__reklamation',
          child_fields: [
            {
              id: 17162023769489,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17056089809169,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_rewe__interne_rueckfrage__allgemein',
          child_fields: [
            {
              id: 17056089809169,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_rewe__nicht_zuordenbar',
          child_fields: [
            {
              id: 17099582070801,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 25340008503313,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 25339999262097,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/16893568315665.json',
      name: 'KK::Rechnungswesen',
      display_name: '',
      created_at: '2023-07-11T09:27:30Z',
      updated_at: '2024-06-14T12:20:46Z',
    },
    {
      id: 16893678722065,
      raw_name: 'KK::Portale/Apps/Datenaustausch',
      raw_display_name: '',
      end_user_visible: false,
      position: 6,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 17108576907281,
        17058159889041, 19423517486097, 24729766128529, 24729862680593, 24729958180241, 24731656468497, 17938716420497,
        12494597108113, 12494577544849, 17055828700049, 16954390432913, 16954483020049, 16954534754577, 17797913489809,
        17797924765457, 17797916113937, 17069899344273, 25340008503313, 25339999262097, 17058615210001, 16955310159121,
        23076076221841, 17057411767441, 17058083681169, 17114269301265, 17114297928337, 19564102566801, 17058107579665,
        19439745629969, 19687267064977, 19687260202641, 19687316508305, 19513037635729, 18024582907409, 18841597727889,
        18841598660113, 18841599244177, 17058642584593, 20604041987729, 17058223706897, 23195259576849, 23699173960465,
        24133997651473,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 16954390432913,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 16954483020049,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 16954483020049,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 16954534754577,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
            {
              id: 17797913489809,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17797916113937,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17797924765457,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 25340008503313,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 25339999262097,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/16893678722065.json',
      name: 'KK::Portale/Apps/Datenaustausch',
      display_name: '',
      created_at: '2023-07-11T09:30:50Z',
      updated_at: '2024-06-14T12:21:04Z',
    },
    {
      id: 17341515330577,
      raw_name: 'KK::EcoTrend',
      raw_display_name: '',
      end_user_visible: false,
      position: 7,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 17108576907281,
        17058159889041, 19423517486097, 24729766128529, 24729862680593, 24729958180241, 24731656468497, 17938716420497,
        12494597108113, 12494577544849, 17055828700049, 16954390432913, 16954483020049, 16954534754577, 17797913489809,
        17797924765457, 17797916113937, 17069899344273, 25340008503313, 25339999262097, 17058615210001, 17056089809169,
        16955310159121, 17057411767441, 23076076221841, 17056466973329, 17083502203537, 17083511576721, 17080405487121,
        17080384737041, 17080429241617, 17081334153105, 17080464909841, 17099582070801, 17058083681169, 17114269301265,
        17114297928337, 19564102566801, 19439745629969, 17058107579665, 18024582907409, 18841597727889, 18841598660113,
        18841599244177, 19687267064977, 19687260202641, 19687316508305, 19513037635729, 17058642584593, 20604041987729,
        17058223706897, 23699173960465, 24133997651473,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 16954390432913,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 16954483020049,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 16954483020049,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 17797916113937,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 16954534754577,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
            {
              id: 17797913489809,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17797924765457,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__nicht_zuordenbar',
          child_fields: [
            {
              id: 17099582070801,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__interne_rueckfrage',
          child_fields: [
            {
              id: 17056089809169,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__rueckfragen__rechnungswesen',
          child_fields: [
            {
              id: 17056089809169,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__onlineportale__registrierungsschreiben',
          child_fields: [
            {
              id: 17056466973329,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__onlineportale__unvollstaendige_adressdaten_app',
          child_fields: [
            {
              id: 17056466973329,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17080405487121,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17080384737041,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17081334153105,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17080464909841,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17080429241617,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__onlineportale__uvi_per_mail_app_nicht_erhalten',
          child_fields: [
            {
              id: 17056466973329,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__onlineportale__registrierungsstatus_webportal',
          child_fields: [
            {
              id: 17056466973329,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__onlineportale__supportanfrage_app',
          child_fields: [
            {
              id: 17056466973329,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__rueckfragen__verbrauchsplausibilisierung',
          child_fields: [
            {
              id: 17056466973329,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 17108576907281,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__onlineportale__ueberpruefung_adressdaten_app',
          child_fields: [
            {
              id: 17056466973329,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 25340008503313,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 25339999262097,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/17341515330577.json',
      name: 'KK::EcoTrend',
      display_name: '',
      created_at: '2023-07-28T05:30:22Z',
      updated_at: '2024-06-14T12:21:21Z',
    },
    {
      id: 17342297613969,
      raw_name: 'KK::Datenverarbeitung',
      raw_display_name: '',
      end_user_visible: false,
      position: 8,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 17108576907281,
        17058159889041, 19423517486097, 24729766128529, 24729862680593, 24729958180241, 24731656468497, 17938716420497,
        12494597108113, 12494577544849, 17055828700049, 16954390432913, 16954483020049, 16954534754577, 17797913489809,
        17797924765457, 17797916113937, 17069899344273, 25340008503313, 25339999262097, 17058615210001, 16955310159121,
        17057411767441, 23076076221841, 17056466973329, 17058083681169, 17114269301265, 17114297928337, 19564102566801,
        19439745629969, 17058107579665, 18024582907409, 18841597727889, 18841598660113, 18841599244177, 19687267064977,
        19687260202641, 19687316508305, 19513037635729, 17058642584593, 20604041987729, 17058223706897, 23195259576849,
        23699173960465, 24133997651473,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 16954390432913,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 16954483020049,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 16954483020049,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 16954534754577,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
            {
              id: 17797913489809,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17797916113937,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17797924765457,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 25340008503313,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 25339999262097,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/17342297613969.json',
      name: 'KK::Datenverarbeitung',
      display_name: '',
      created_at: '2023-07-28T06:27:47Z',
      updated_at: '2024-06-14T12:22:54Z',
    },
    {
      id: 18024600709393,
      raw_name: 'KK::Angebotsformular',
      raw_display_name: '',
      end_user_visible: false,
      position: 9,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 12494597108113,
        12494577544849, 17108576907281, 17058159889041, 19423517486097, 18024566146705, 17058615210001, 17057411767441,
        23076076221841, 20048446490769, 18024555336337, 18842672362769, 18842658900369, 18842705544593, 17282793060625,
        17057716651793, 18024582907409, 18841597727889, 18841598660113, 18841599244177, 18024538463633, 18024589301265,
        18843277810449, 18843324438289, 18843325305873, 18843326220305, 17938716420497, 16954390432913, 16954483020049,
        16954534754577, 16955310159121, 17114269301265, 17114297928337, 17797913489809, 17797916113937, 17797924765457,
        19564102566801, 17058642584593, 20604041987729, 17058223706897, 23699173960465, 24133997651473,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 16954390432913,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 16954483020049,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 16954483020049,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 17797916113937,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 16954534754577,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
            {
              id: 17797913489809,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 17797924765457,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 18024566146705,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 23076076221841,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17058615210001,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/18024600709393.json',
      name: 'KK::Angebotsformular',
      display_name: '',
      created_at: '2023-08-24T11:39:08Z',
      updated_at: '2024-04-16T09:17:02Z',
    },
    {
      id: 20046046634129,
      raw_name: 'KK::NK::Abrechnungswesen',
      raw_display_name: '',
      end_user_visible: false,
      position: 10,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 18192604177041,
        12494597108113, 12494577544849, 20020883517073, 17055828700049, 16954390432913, 16954483020049, 16954534754577,
        17069899344273, 17058615210001, 17057411767441, 23076076221841, 19826842578961, 19852692468497, 17058107579665,
        17108576907281, 21686435307025, 17057716651793, 17282793060625, 17083502203537, 17083511576721, 19853906619281,
        17114269301265, 17114297928337, 19995334336657, 20041586510609, 19439903378577, 19439745629969, 19687267064977,
        19687260202641, 19687316508305, 19513037635729, 18024582907409, 18841597727889, 18841598660113, 18841599244177,
        17058642584593, 17058223706897, 23699173960465, 24133997651473,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 16954390432913,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 16954483020049,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 16954483020049,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 16954534754577,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'abrechnungswesen__aufgabe_erteilen__korrekturauftrag_ausfuehren',
          child_fields: [
            {
              id: 19826842578961,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
            {
              id: 19852692468497,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/20046046634129.json',
      name: 'KK::NK::Abrechnungswesen',
      display_name: '',
      created_at: '2023-11-10T13:20:42Z',
      updated_at: '2024-06-14T13:43:37Z',
    },
    {
      id: 20046290908305,
      raw_name: 'KK::NK::Datenpflege',
      raw_display_name: '',
      end_user_visible: false,
      position: 11,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 18192604177041,
        12494597108113, 12494577544849, 20020883517073, 17055828700049, 16954390432913, 16954483020049, 16954534754577,
        17058615210001, 17069899344273, 17057411767441, 23076076221841, 17058107579665, 21686435307025, 17057716651793,
        17282793060625, 17083502203537, 17083511576721, 17056466973329, 17080213206801, 17056427535121, 17057390958993,
        17114269301265, 17114297928337, 19995334336657, 20041586510609, 19439903378577, 19439745629969, 19687267064977,
        19687260202641, 19687316508305, 19513037635729, 18024582907409, 18841597727889, 18841598660113, 18841599244177,
        17058642584593, 17058223706897, 23699173960465, 24133997651473,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 16954390432913,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 16954483020049,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 16954483020049,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 16954534754577,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'datenpflege__aufgabe_erteilen__kundenadressdaten_pflegen',
          child_fields: [
            {
              id: 17057390958993,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'datenpflege__aufgabe_erteilen__liegenschaftsstruktur_pflegen',
          child_fields: [
            {
              id: 17057390958993,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'datenpflege__aufgabe_erteilen__geraete_nutzerdaten_pflegen',
          child_fields: [
            {
              id: 17057390958993,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'datenpflege__aufgabe_erteilen__geraetedaten_pflegen',
          child_fields: [
            {
              id: 17057390958993,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'datenpflege__aufgabe_erteilen__nutzerdaten_pflegen',
          child_fields: [
            {
              id: 17057390958993,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'datenpflege__aufgabe_erteilen__kundenstamm_liegenschaft_pflegen',
          child_fields: [
            {
              id: 17057390958993,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/20046290908305.json',
      name: 'KK::NK::Datenpflege',
      display_name: '',
      created_at: '2023-11-10T13:27:08Z',
      updated_at: '2024-04-16T09:17:17Z',
    },
    {
      id: 20046279157393,
      raw_name: 'KK::NK::Gerätewesen',
      raw_display_name: '',
      end_user_visible: false,
      position: 12,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 18192604177041,
        12494597108113, 12494577544849, 20020883517073, 17055828700049, 16954390432913, 16954483020049, 16954534754577,
        17058615210001, 17069899344273, 17057411767441, 23076076221841, 17058107579665, 17056464101393, 17108576907281,
        21686435307025, 17057716651793, 17282793060625, 17083502203537, 17083511576721, 17056466973329, 17080213206801,
        17056427535121, 20096414384401, 17080405487121, 17080384737041, 17080429241617, 17081334153105, 17080464909841,
        17070454222993, 17070429186577, 17114269301265, 17114297928337, 19995334336657, 20041586510609, 19439903378577,
        19439745629969, 19687267064977, 19687260202641, 19687316508305, 19513037635729, 18024582907409, 18841597727889,
        18841598660113, 18841599244177, 17058642584593, 17058223706897, 23699173960465,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 16954390432913,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 16954483020049,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 16954483020049,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 16954534754577,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'geraetewesen__aufgabe_erteilen__auftrag_anlegen',
          child_fields: [
            {
              id: 20096414384401,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'geraetewesen__aufgabe_erteilen__stellungnahme_isp_einholen',
          child_fields: [
            {
              id: 17056464101393,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'geraetewesen__aufgabe_erteilen__auftrag_aendern_disponieren',
          child_fields: [
            {
              id: 17056464101393,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'geraetewesen__aufgabe_erteilen__auftrag_stornieren',
          child_fields: [
            {
              id: 17056464101393,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'geraetewesen__aufgabe_erteilen__termin__auftragsstatus_klaeren',
          child_fields: [
            {
              id: 17056464101393,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'geraetewesen__aufgabe_erteilen__auftragsgrund_ermitteln',
          child_fields: [
            {
              id: 17056464101393,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'geraetewesen__aufgabe_erteilen__sachschaden_messtechnik',
          child_fields: [
            {
              id: 17070429186577,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17070454222993,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'geraetewesen__aufgabe_erteilen__schadensklaerung_einleiten',
          child_fields: [
            {
              id: 17070454222993,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17070429186577,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 20096414384401,
          parent_field_type: 'tagger',
          value: 'auftragsart_warenversand',
          child_fields: [
            {
              id: 17080384737041,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17080429241617,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17081334153105,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17080464909841,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 17080405487121,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/20046279157393.json',
      name: 'KK::NK::Gerätewesen',
      display_name: '',
      created_at: '2023-11-10T13:27:41Z',
      updated_at: '2024-03-28T12:25:27Z',
    },
    {
      id: 20046303014801,
      raw_name: 'KK::NK::Rechnungswesen',
      raw_display_name: '',
      end_user_visible: false,
      position: 13,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 18192604177041,
        12494597108113, 12494577544849, 20020883517073, 17055828700049, 16954390432913, 16954483020049, 16954534754577,
        17058615210001, 17069899344273, 17057411767441, 23076076221841, 17058107579665, 17108576907281, 21686435307025,
        17057716651793, 17282793060625, 17083502203537, 17083511576721, 17057299687057, 17056089809169, 17055974883345,
        17055989454865, 17114269301265, 17114297928337, 19995334336657, 20041586510609, 19439903378577, 19439745629969,
        18024582907409, 18841597727889, 18841598660113, 18841599244177, 19687267064977, 19687260202641, 19687316508305,
        19513037635729, 17058642584593, 17058223706897, 23699173960465, 24133997651473,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 16954483020049,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 16954534754577,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 16954390432913,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 16954483020049,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'rechnungswesen__aufgabe_erteilen__storno_vertriebsrechnung_ohne_lgnr',
          child_fields: [
            {
              id: 17056089809169,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'rechnungswesen__aufgabe_erteilen__lastschriftmandat_einrichten',
          child_fields: [
            {
              id: 17057299687057,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'rechnungswesen__aufgabe_erteilen__ratenzahlung_einstellen',
          child_fields: [
            {
              id: 17056089809169,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'rechnungswesen__information_einholen_weitergeben__zu_buchhaltungsthemen',
          child_fields: [
            {
              id: 17056089809169,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'rechnungswesen__information_einholen_weitergeben__zu_mahn-_und_klage_themen',
          child_fields: [
            {
              id: 17056089809169,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'rechnungswesen__aufgabe_erteilen__storno_vertriebsrechnung_mit_lgnr',
          child_fields: [
            {
              id: 17056089809169,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
      ],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/20046303014801.json',
      name: 'KK::NK::Rechnungswesen',
      display_name: '',
      created_at: '2023-11-10T13:28:10Z',
      updated_at: '2024-04-16T09:17:25Z',
    },
    {
      id: 20046349596433,
      raw_name: 'KK::NK::Vertragswesen',
      raw_display_name: '',
      end_user_visible: false,
      position: 14,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 18192604177041,
        12494597108113, 12494577544849, 20020883517073, 17055828700049, 16954390432913, 16954483020049, 16954534754577,
        17069899344273, 17057411767441, 23076076221841, 17058107579665, 17083502203537, 17083511576721, 18024566146705,
        17058615210001, 21686435307025, 17057716651793, 17282793060625, 20048446490769, 18024555336337, 18842672362769,
        18842658900369, 18842705544593, 17114269301265, 17114297928337, 19995334336657, 20041586510609, 19439903378577,
        18024538463633, 18024589301265, 18843277810449, 18843324438289, 18843325305873, 18843326220305, 18024582907409,
        18841597727889, 18841598660113, 18841599244177, 19439745629969, 19687267064977, 19687260202641, 19687316508305,
        19513037635729, 17058642584593, 17058223706897, 23699173960465, 24133997651473,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 16954390432913,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 16954483020049,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 16954483020049,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 16954534754577,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/20046349596433.json',
      name: 'KK::NK::Vertragswesen',
      display_name: '',
      created_at: '2023-11-10T13:28:44Z',
      updated_at: '2024-04-16T09:17:33Z',
    },
    {
      id: 20046352796817,
      raw_name: 'KK::NK::Vorgang komplett übergeben',
      raw_display_name: '',
      end_user_visible: false,
      position: 15,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 18192604177041,
        12494597108113, 12494577544849, 20020883517073, 17055828700049, 16954390432913, 16954483020049, 16954534754577,
        17058615210001, 17069899344273, 17057411767441, 23076076221841, 17058107579665, 19733804865297, 21686435307025,
        17057716651793, 17282793060625, 17083502203537, 17083511576721, 17080405487121, 17080384737041, 17080429241617,
        17081334153105, 17080464909841, 17114269301265, 17114297928337, 19995334336657, 20041586510609, 19439903378577,
        19439745629969, 18024582907409, 18841597727889, 18841598660113, 18841599244177, 19687267064977, 19687260202641,
        19687316508305, 19513037635729, 17058642584593, 17058223706897, 23699173960465, 24133997651473,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 16954390432913,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 16954483020049,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 16954483020049,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 16954534754577,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'vorgang_komplett_uebergeben__nutzeranfrage',
          child_fields: [
            {
              id: 19733804865297,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['hold', 'solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 18192604177041,
          parent_field_type: 'tagger',
          value: 'vorgang_komplett_uebergeben__nutzerbeschwerde',
          child_fields: [
            {
              id: 19733804865297,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['hold', 'solved'],
              },
            },
          ],
        },
      ],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/20046352796817.json',
      name: 'KK::NK::Vorgang komplett übergeben',
      display_name: '',
      created_at: '2023-11-10T13:29:19Z',
      updated_at: '2024-04-16T09:17:39Z',
    },
    {
      id: 22881255986705,
      raw_name: 'KK::NK::externe Kommunikation',
      raw_display_name: '',
      end_user_visible: false,
      position: 16,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 12494597108113,
        12494577544849, 20020883517073, 17055828700049, 17058615210001, 17069899344273, 17057411767441, 23076076221841,
        17114269301265, 17114297928337, 19439903378577, 19439745629969, 17058642584593, 18841597727889, 18841599244177,
        18841598660113, 18024582907409, 17058223706897, 23699173960465, 24133997651473,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/22881255986705.json',
      name: 'KK::NK::externe Kommunikation',
      display_name: '',
      created_at: '2024-02-26T11:24:40Z',
      updated_at: '2024-04-16T09:17:45Z',
    },
    {
      id: 23947426995857,
      raw_name: 'Adminformular',
      raw_display_name: '',
      end_user_visible: false,
      position: 17,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 12494613881233, 12494582969489, 17114269301265,
        17114297928337,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/23947426995857.json',
      name: 'Adminformular',
      display_name: '',
      created_at: '2024-04-05T14:27:16Z',
      updated_at: '2024-04-05T14:38:47Z',
    },
    {
      id: 25759806575377,
      raw_name: 'KK::QM::Stichprobenformular',
      raw_display_name: '',
      end_user_visible: false,
      position: 18,
      ticket_field_ids: [
        12494577544209, 12494613882513, 12494582971281, 12494613881745, 25838235902737, 17108576907281, 19564102566801,
        25759172989713, 25759227953041, 12494613881233, 12494582969489, 25759286741137, 25759290539921, 25759307482513,
        25759399566097, 25759436811921, 25759471985937, 25759449718673, 25759685329425, 25759707183505, 25759740077969,
        25759757747857, 17114269301265, 17114297928337,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [],
      url: 'https://istase.zendesk.com/api/v2/ticket_forms/25759806575377.json',
      name: 'KK::QM::Stichprobenformular',
      display_name: '',
      created_at: '2024-06-08T19:30:49Z',
      updated_at: '2024-06-11T13:07:28Z',
    },
  ],
  next_page: null,
  previous_page: null,
  count: 19,
}

const dummyData = {
  ticket_forms: [
    {
      id: 11658399815068,
      raw_name: 'Standardticketformular',
      raw_display_name: 'Standardticketformular',
      end_user_visible: true,
      position: 0,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 11854111960604,
        11854169281820, 11854135735068, 13829385118236, 13829340678940, 13829342877084, 13829372747292, 11854120015004,
        10484199315740, 10484259036060, 11854111953564, 11854111951260, 11854154967708, 11854111915164, 11854135701532,
        11854169256860, 11854135706524, 11854135703324, 14141775636508, 14141715129116, 11854120778908, 11854152771228,
        12353986986908, 12353982093212, 11854152783004, 11854169279900, 11854152744092, 11854119970332, 11854152744348,
        11854152744476, 11854111889564, 11854111841948, 11854360344220, 11854344589596, 11854360341788, 11854326509212,
        11854361283868, 13041525515292, 13445708966172, 13573341015964,
      ],
      active: true,
      default: true,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 11854154967708,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 11854135701532,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854169256860,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854135706524,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854111915164,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111951260,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854154967708,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 14141775636508,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 14141715129116,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/11658399815068.json',
      name: 'Standardticketformular',
      display_name: 'Standardticketformular',
      created_at: '2023-12-07T15:06:23Z',
      updated_at: '2024-06-17T08:20:07Z',
    },
    {
      id: 11854362601500,
      raw_name: 'KK::allgemeine Anfragen',
      raw_display_name: '',
      end_user_visible: false,
      position: 1,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 11854111960604,
        11854169281820, 11854135735068, 13829385118236, 13829340678940, 13829342877084, 13829372747292, 11854120015004,
        10484199315740, 10484259036060, 11854111953564, 11854111951260, 11854154967708, 11854111915164, 11854135701532,
        11854169256860, 11854135706524, 11854135703324, 14141775636508, 14141715129116, 11854120778908, 12943563037212,
        12943563037084, 11854330320668, 11854326642972, 11854376688284, 11854360449564, 11854346326172, 11854379700124,
        11854345857948, 11854376670620, 11854326647836, 11854386637212, 11854330281756, 11854152771228, 12353986986908,
        12353982093212, 11854344772252, 11854152783004, 11854169279900, 11854152744092, 11854119970332, 11854152744348,
        11854152744476, 11854326509212, 11854360344220, 11854360341788, 11854344589596, 11854111889564, 11854111841948,
        11854361283868, 13041525515292, 13445708966172, 13573341015964,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 11854111951260,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854154967708,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854154967708,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 11854135706524,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854169256860,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854135701532,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854111915164,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_allgemein__dsgvo__datenschutzvorfall_meldung',
          child_fields: [
            {
              id: 11854386637212,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854345857948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854326642972,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_allgemein__kopieanforderung',
          child_fields: [
            {
              id: 11854326642972,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854330320668,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_allgemein__nicht_zuordenbar',
          child_fields: [
            {
              id: 11854326647836,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 14141775636508,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 14141715129116,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/11854362601500.json',
      name: 'KK::allgemeine Anfragen',
      display_name: '',
      created_at: '2023-12-20T15:55:30Z',
      updated_at: '2024-06-17T08:20:34Z',
    },
    {
      id: 11854333526300,
      raw_name: 'KK::Field Service Management',
      raw_display_name: '',
      end_user_visible: false,
      position: 2,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 11854111960604,
        11854169281820, 11854135735068, 13829385118236, 13829340678940, 13829342877084, 13829372747292, 11854120015004,
        10484199315740, 10484259036060, 11854111953564, 11854111951260, 11854154967708, 11854111915164, 11854135701532,
        11854169256860, 11854135706524, 11854376674460, 11854330820508, 11854135703324, 14141775636508, 14141715129116,
        11854120778908, 11854152771228, 12943563037212, 12943563037084, 11854346321948, 11854345857948, 11854326642972,
        11854376688284, 11854360449564, 11854346326172, 11854379700124, 11854330320668, 11854330210204, 11854344675484,
        11854318540956, 11854377313564, 11854327782044, 11854362557340, 11854330320156, 11854386637212, 11854330281756,
        11854326647836, 12353986986908, 12353982093212, 11854344772252, 11854169279900, 11854152783004, 11854326509212,
        11854360344220, 11854360341788, 11854344589596, 11854152744092, 11854119970332, 11854152744348, 11854152744476,
        11854111889564, 11854111841948, 11854361283868, 13041525515292, 13445708966172, 13573341015964,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 11854154967708,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 11854135706524,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854111915164,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
            {
              id: 11854135701532,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854169256860,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 11854376674460,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854330820508,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__beauftragung__geraeteaustausch',
          child_fields: [
            {
              id: 11854346321948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__beauftragung__mitteilung_kontaktdaten_mieter',
          child_fields: [
            {
              id: 11854345857948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__beauftragung__montage_demontage',
          child_fields: [
            {
              id: 11854346321948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__beauftragung__warenversand',
          child_fields: [
            {
              id: 11854318540956,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854327782044,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854330320156,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854362557340,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854377313564,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__interne_rueckfrage__amm',
          child_fields: [
            {
              id: 11854345857948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__nicht_zuordenbar',
          child_fields: [
            {
              id: 11854326647836,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__schaden__schadenersatzansprueche',
          child_fields: [
            {
              id: 11854345857948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854386637212,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__schaden__schadensmeldung',
          child_fields: [
            {
              id: 11854346321948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854330210204,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854344675484,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__beauftragung__geraetereklamation',
          child_fields: [
            {
              id: 11854346321948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__beauftragung__neuaufnahme',
          child_fields: [
            {
              id: 11854346321948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__interne_rueckfrage__amm',
          child_fields: [
            {
              id: 11854345857948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__rechnungswesen__rechnungsreklamation',
          child_fields: [
            {
              id: 11854386637212,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854330320668,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__schaden__schadenersatzansprueche',
          child_fields: [
            {
              id: 11854345857948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854386637212,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__schaden__schadensmeldung',
          child_fields: [
            {
              id: 11854346321948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__beauftragung__ablesung',
          child_fields: [
            {
              id: 11854346321948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__beauftragung__geraetereklamation',
          child_fields: [
            {
              id: 11854346321948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__beauftragung__kostenanfrage_auftrag',
          child_fields: [
            {
              id: 11854346321948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__messtechnik__beauftragung__neuaufnahme_lg_ne',
          child_fields: [
            {
              id: 11854346321948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__auftrag__auftragsgrund',
          child_fields: [
            {
              id: 11854345857948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__beauftragung__funktionspruefung',
          child_fields: [
            {
              id: 11854346321948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__beauftragung__kostenanfrage_auftrag',
          child_fields: [
            {
              id: 11854346321948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__beauftragung__mitteilung_kontaktdaten_mieter',
          child_fields: [
            {
              id: 11854345857948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__beauftragung__montage_demontage',
          child_fields: [
            {
              id: 11854346321948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__nicht_zuordenbar_allgemein',
          child_fields: [
            {
              id: 11854326647836,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_fsm__rwm__rechnungswesen__stornobeleg',
          child_fields: [
            {
              id: 11854330320668,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111951260,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854154967708,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 14141775636508,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 14141715129116,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/11854333526300.json',
      name: 'KK::Field Service Management',
      display_name: '',
      created_at: '2023-12-20T15:55:31Z',
      updated_at: '2024-06-17T08:20:56Z',
    },
    {
      id: 11854362596252,
      raw_name: 'KK::Vertragsmanagement',
      raw_display_name: '',
      end_user_visible: false,
      position: 3,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 11854111960604,
        11854169281820, 11854135735068, 13829385118236, 13829340678940, 13829342877084, 13829372747292, 11854120015004,
        10484199315740, 10484259036060, 11854111953564, 11854111951260, 11854154967708, 11854111915164, 11854135701532,
        11854169256860, 11854135706524, 11854135703324, 14141775636508, 14141715129116, 11854120778908, 11854152771228,
        12943563037212, 12943563037084, 11854346326172, 11854379700124, 11854330281756, 12353986986908, 12353982093212,
        11854344772252, 11854152783004, 11854169279900, 11854326509212, 11854360344220, 11854360341788, 11854344589596,
        11854152744092, 11854119970332, 11854152744348, 11854152744476, 11854111889564, 11854111841948, 11854361283868,
        13041525515292, 13445708966172, 13573341015964,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 11854111951260,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854154967708,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854154967708,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 11854169256860,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854111915164,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
            {
              id: 11854135706524,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854135701532,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 14141775636508,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 14141715129116,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/11854362596252.json',
      name: 'KK::Vertragsmanagement',
      display_name: '',
      created_at: '2023-12-20T15:55:30Z',
      updated_at: '2024-06-17T08:21:14Z',
    },
    {
      id: 11854333495580,
      raw_name: 'KK::Abrechnungsservice',
      raw_display_name: '',
      end_user_visible: false,
      position: 4,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 11854111960604,
        11854169281820, 11854135735068, 13829385118236, 13829340678940, 13829342877084, 13829372747292, 11854120015004,
        10484199315740, 10484259036060, 11854111953564, 11854111951260, 11854154967708, 11854111915164, 11854135701532,
        11854169256860, 11854135706524, 11854376674460, 11854330820508, 11854135703324, 14141775636508, 14141715129116,
        11854120778908, 11854330274204, 11854318598428, 11854330320668, 11854152771228, 12943563037212, 12943563037084,
        11854346326172, 11854379700124, 11854330191516, 11854326642972, 11854360449564, 11854326647836, 11854386637212,
        11854330281756, 12353986986908, 12353982093212, 11854344772252, 11854152783004, 11854169279900, 11854326509212,
        11854360344220, 11854360341788, 11854344589596, 11854152744092, 11854119970332, 11854152744348, 11854152744476,
        11854111889564, 11854111841948, 11854361283868, 13041525515292, 13445708966172, 13573341015964,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 11854154967708,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 11854135701532,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854135706524,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854169256860,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854111915164,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_abre__beauskunftung__schlussrechnung',
          child_fields: [
            {
              id: 11854330320668,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_abre__korrektur__abrechnungskorrektur',
          child_fields: [
            {
              id: 11854318598428,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854330274204,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854386637212,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_abre__korrektur__widerspruch_rechtsanwalt',
          child_fields: [
            {
              id: 11854386637212,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_abre__schadenersatzanspruch__abrechnung',
          child_fields: [
            {
              id: 11854386637212,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854330320668,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_abre__verbrauchswerte__schaetzung_beauftragung',
          child_fields: [
            {
              id: 11854360449564,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854326642972,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_abre__beauskunftung__schaetzung',
          child_fields: [
            {
              id: 11854326642972,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854360449564,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_abre__nicht_zuordenbar',
          child_fields: [
            {
              id: 11854326647836,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_abre__verbrauchswerte__anforderung',
          child_fields: [
            {
              id: 11854326642972,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854360449564,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_abre__verbrauchswerte__pruefung',
          child_fields: [
            {
              id: 11854326642972,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854360449564,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111951260,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854154967708,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854376674460,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854330820508,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 14141775636508,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 14141715129116,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/11854333495580.json',
      name: 'KK::Abrechnungsservice',
      display_name: '',
      created_at: '2023-12-20T15:55:30Z',
      updated_at: '2024-06-17T13:06:31Z',
    },
    {
      id: 11854333493660,
      raw_name: 'KK::Rechnungswesen',
      raw_display_name: '',
      end_user_visible: false,
      position: 5,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 11854111960604,
        11854169281820, 11854135735068, 13829385118236, 13829340678940, 13829342877084, 13829372747292, 11854120015004,
        10484199315740, 10484259036060, 11854111953564, 11854111951260, 11854154967708, 11854111915164, 11854135701532,
        11854169256860, 11854135706524, 11854135703324, 14141775636508, 14141715129116, 11854120778908, 11854152771228,
        12943563037212, 12943563037084, 11854330320668, 11854326650012, 11854332897436, 11854326649628, 11854326647836,
        11854386637212, 11854330281756, 12353986986908, 12353982093212, 11854344772252, 11854169279900, 11854152783004,
        11854152744092, 11854119970332, 11854152744348, 11854152744476, 11854326509212, 11854360344220, 11854360341788,
        11854344589596, 11854111889564, 11854111841948, 11854361283868, 13041525515292, 13445708966172, 13573341015964,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 11854154967708,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 11854135706524,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854135701532,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854169256860,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854111915164,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_rewe__nicht_zuordenbar',
          child_fields: [
            {
              id: 11854326647836,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_rewe__rechnung__reklamation',
          child_fields: [
            {
              id: 11854330320668,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854386637212,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_rewe__rechnung__stornobeleg',
          child_fields: [
            {
              id: 11854330320668,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_rewe__interne_rueckfrage__allgemein',
          child_fields: [
            {
              id: 11854330320668,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111951260,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854154967708,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 14141775636508,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 14141715129116,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/11854333493660.json',
      name: 'KK::Rechnungswesen',
      display_name: '',
      created_at: '2023-12-20T15:55:30Z',
      updated_at: '2024-06-17T08:21:44Z',
    },
    {
      id: 11854362593308,
      raw_name: 'KK::Portale/Apps/Datenaustausch',
      raw_display_name: '',
      end_user_visible: false,
      position: 6,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 11854111960604,
        11854169281820, 11854135735068, 13829385118236, 13829340678940, 13829342877084, 13829372747292, 11854120015004,
        10484199315740, 10484259036060, 11854111953564, 11854111951260, 11854154967708, 11854111915164, 11854135701532,
        11854169256860, 11854135706524, 11854135703324, 14141775636508, 14141715129116, 11854120778908, 11854152771228,
        12943563037084, 12943563037212, 11854330281756, 12353986986908, 12353982093212, 11854344772252, 11854152783004,
        11854169279900, 11854152744092, 11854119970332, 11854152744348, 11854152744476, 11854326509212, 11854360344220,
        11854360341788, 11854344589596, 11854111889564, 11854111841948, 11854361283868, 13041525515292, 13445708966172,
        13573341015964,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 11854154967708,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 11854135706524,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854169256860,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854111915164,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
            {
              id: 11854135701532,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 11854111951260,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854154967708,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 14141775636508,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 14141715129116,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/11854362593308.json',
      name: 'KK::Portale/Apps/Datenaustausch',
      display_name: '',
      created_at: '2023-12-20T15:55:30Z',
      updated_at: '2024-06-17T08:22:00Z',
    },
    {
      id: 11854388209564,
      raw_name: 'KK::EcoTrend',
      raw_display_name: '',
      end_user_visible: false,
      position: 7,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 11854111960604,
        11854169281820, 11854135735068, 13829385118236, 13829340678940, 13829342877084, 13829372747292, 11854120015004,
        10484199315740, 10484259036060, 11854111953564, 11854111951260, 11854154967708, 11854111915164, 11854135701532,
        11854169256860, 11854135706524, 11854135703324, 14141775636508, 14141715129116, 11854120778908, 11854330320668,
        11854152771228, 12943563037212, 12943563037084, 11854326642972, 11854346326172, 11854379700124, 11854318540956,
        11854377313564, 11854327782044, 11854362557340, 11854330320156, 11854326647836, 11854330281756, 12353986986908,
        12353982093212, 11854344772252, 11854169279900, 11854152783004, 11854326509212, 11854360344220, 11854360341788,
        11854344589596, 11854152744092, 11854119970332, 11854152744348, 11854152744476, 11854111889564, 11854111841948,
        11854361283868, 13445708966172, 13573341015964,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 11854111951260,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854154967708,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854154967708,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 11854135701532,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854169256860,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854135706524,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854111915164,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__interne_rueckfrage',
          child_fields: [
            {
              id: 11854330320668,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__nicht_zuordenbar',
          child_fields: [
            {
              id: 11854326647836,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__onlineportale__unvollstaendige_adressdaten_app',
          child_fields: [
            {
              id: 11854326642972,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854327782044,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854330320156,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854362557340,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854377313564,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854318540956,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__rueckfragen__rechnungswesen',
          child_fields: [
            {
              id: 11854330320668,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__rueckfragen__verbrauchsplausibilisierung',
          child_fields: [
            {
              id: 11854326642972,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__onlineportale__registrierungsschreiben',
          child_fields: [
            {
              id: 11854326642972,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__onlineportale__registrierungsstatus_webportal',
          child_fields: [
            {
              id: 11854326642972,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__onlineportale__supportanfrage_app',
          child_fields: [
            {
              id: 11854326642972,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__onlineportale__ueberpruefung_adressdaten_app',
          child_fields: [
            {
              id: 11854326642972,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111960604,
          parent_field_type: 'tagger',
          value: 'gf_ecotrend__onlineportale__uvi_per_mail_app_nicht_erhalten',
          child_fields: [
            {
              id: 11854326642972,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 14141775636508,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 14141715129116,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/11854388209564.json',
      name: 'KK::EcoTrend',
      display_name: '',
      created_at: '2023-12-20T15:55:30Z',
      updated_at: '2024-06-17T08:22:19Z',
    },
    {
      id: 11854362611612,
      raw_name: 'KK::Datenverarbeitung',
      raw_display_name: '',
      end_user_visible: false,
      position: 8,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 11854111960604,
        11854169281820, 11854135735068, 13829385118236, 13829340678940, 13829342877084, 13829372747292, 11854120015004,
        10484199315740, 10484259036060, 11854111953564, 11854111951260, 11854154967708, 11854111915164, 11854135701532,
        11854169256860, 11854135706524, 11854135703324, 14141775636508, 14141715129116, 11854120778908, 11854152771228,
        12943563037212, 12943563037084, 11854326642972, 11854330281756, 12353986986908, 12353982093212, 11854344772252,
        11854169279900, 11854152783004, 11854326509212, 11854360344220, 11854360341788, 11854344589596, 11854152744092,
        11854119970332, 11854152744348, 11854152744476, 11854111889564, 11854111841948, 11854361283868, 13041525515292,
        13445708966172, 13573341015964,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 11854154967708,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 11854135701532,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854169256860,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854135706524,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854111915164,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111951260,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854154967708,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 14141775636508,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 14141715129116,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/11854362611612.json',
      name: 'KK::Datenverarbeitung',
      display_name: '',
      created_at: '2023-12-20T15:55:30Z',
      updated_at: '2024-06-17T08:22:35Z',
    },
    {
      id: 11854362601628,
      raw_name: 'KK::Angebotsformular',
      raw_display_name: '',
      end_user_visible: false,
      position: 9,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 10484199315740,
        10484259036060, 11854111960604, 11854169281820, 11854135735068, 11854318428188, 11854120778908, 12943563037212,
        12943563037084, 11854318428828, 11854326524316, 11854330189084, 11854330191900, 11854330189980, 11854326644252,
        11854360446748, 11854326509212, 11854360344220, 11854360341788, 11854344589596, 11854330190108, 11854330202524,
        11854360350364, 11854330188956, 11854330189596, 11854318446108, 11854120015004, 11854111951260, 11854154967708,
        11854111915164, 11854152771228, 12353986986908, 12353982093212, 11854135701532, 11854135706524, 11854169256860,
        11854344772252, 11854111889564, 11854111841948, 11854361283868, 13445708966172, 13573341015964,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 11854111951260,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854154967708,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854154967708,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 11854135706524,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854135701532,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854169256860,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
            {
              id: 11854111915164,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854318428188,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 12943563037084,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854120778908,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/11854362601628.json',
      name: 'KK::Angebotsformular',
      display_name: '',
      created_at: '2023-12-20T15:55:30Z',
      updated_at: '2024-05-03T15:02:16Z',
    },
    {
      id: 11854379940892,
      raw_name: 'KK::NK::Abrechnungswesen',
      raw_display_name: '',
      end_user_visible: false,
      position: 10,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 11854326643996,
        10484199315740, 10484259036060, 11854376632220, 11854111953564, 11854111951260, 11854154967708, 11854111915164,
        11854135703324, 11854120778908, 12943563037212, 12943563037084, 11854330274204, 11854318598428, 11854152783004,
        11854111960604, 12415932455708, 11854360446748, 11854326644252, 11854346326172, 11854379700124, 11854330191516,
        12353986986908, 12353982093212, 11854360419868, 11854326643356, 11854318503324, 11854169279900, 11854152744092,
        11854119970332, 11854152744348, 11854152744476, 11854326509212, 11854360344220, 11854360341788, 11854344589596,
        11854111889564, 11854361283868, 13445708966172, 13573341015964,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 11854111951260,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854154967708,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'abrechnungswesen__aufgabe_erteilen__korrekturauftrag_ausfuehren',
          child_fields: [
            {
              id: 11854318598428,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
            {
              id: 11854330274204,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854154967708,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 11854111915164,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/11854379940892.json',
      name: 'KK::NK::Abrechnungswesen',
      display_name: '',
      created_at: '2023-12-20T15:55:30Z',
      updated_at: '2024-06-17T13:06:31Z',
    },
    {
      id: 11854362595100,
      raw_name: 'KK::NK::Datenpflege',
      raw_display_name: '',
      end_user_visible: false,
      position: 11,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 11854326643996,
        10484199315740, 10484259036060, 11854376632220, 11854111953564, 11854111951260, 11854154967708, 11854111915164,
        11854120778908, 11854135703324, 12943563037212, 12943563037084, 11854152783004, 12415932455708, 11854360446748,
        11854326644252, 11854346326172, 11854379700124, 11854326642972, 11854376688284, 11854360449564, 11854376670620,
        12353986986908, 12353982093212, 11854360419868, 11854326643356, 11854318503324, 11854169279900, 11854152744092,
        11854119970332, 11854152744348, 11854152744476, 11854326509212, 11854360344220, 11854360341788, 11854344589596,
        11854111889564, 11854361283868, 13445708966172, 13573341015964,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 11854111951260,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854154967708,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854154967708,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 11854111915164,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'datenpflege__aufgabe_erteilen__geraetedaten_pflegen',
          child_fields: [
            {
              id: 11854376670620,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'datenpflege__aufgabe_erteilen__kundenstamm_liegenschaft_pflegen',
          child_fields: [
            {
              id: 11854376670620,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'datenpflege__aufgabe_erteilen__liegenschaftsstruktur_pflegen',
          child_fields: [
            {
              id: 11854376670620,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'datenpflege__aufgabe_erteilen__geraete_nutzerdaten_pflegen',
          child_fields: [
            {
              id: 11854376670620,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'datenpflege__aufgabe_erteilen__kundenadressdaten_pflegen',
          child_fields: [
            {
              id: 11854376670620,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'datenpflege__aufgabe_erteilen__nutzerdaten_pflegen',
          child_fields: [
            {
              id: 11854376670620,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/11854362595100.json',
      name: 'KK::NK::Datenpflege',
      display_name: '',
      created_at: '2023-12-20T15:55:30Z',
      updated_at: '2024-05-03T15:02:16Z',
    },
    {
      id: 11854362599836,
      raw_name: 'KK::NK::Gerätewesen',
      raw_display_name: '',
      end_user_visible: false,
      position: 12,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 11854326643996,
        10484199315740, 10484259036060, 11854376632220, 11854111953564, 11854111951260, 11854154967708, 11854111915164,
        11854120778908, 11854135703324, 12943563037212, 12943563037084, 11854152783004, 11854345857948, 11854111960604,
        12415932455708, 11854360446748, 11854326644252, 11854346326172, 11854379700124, 11854326642972, 11854376688284,
        11854360449564, 11854346321948, 11854318540956, 11854377313564, 11854327782044, 11854362557340, 11854330320156,
        11854344675484, 11854330210204, 12353986986908, 12353982093212, 11854360419868, 11854326643356, 11854318503324,
        11854169279900, 11854152744092, 11854119970332, 11854152744348, 11854152744476, 11854326509212, 11854360344220,
        11854360341788, 11854344589596, 11854111889564, 11854361283868, 13445708966172,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 11854346321948,
          parent_field_type: 'tagger',
          value: 'auftragsart_warenversand',
          child_fields: [
            {
              id: 11854318540956,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854330320156,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854362557340,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854377313564,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854327782044,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854154967708,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 11854111915164,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'geraetewesen__aufgabe_erteilen__auftrag_anlegen',
          child_fields: [
            {
              id: 11854346321948,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'geraetewesen__aufgabe_erteilen__schadensklaerung_einleiten',
          child_fields: [
            {
              id: 11854330210204,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854344675484,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'geraetewesen__aufgabe_erteilen__stellungnahme_isp_einholen',
          child_fields: [
            {
              id: 11854345857948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'geraetewesen__aufgabe_erteilen__auftrag_aendern_disponieren',
          child_fields: [
            {
              id: 11854345857948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'geraetewesen__aufgabe_erteilen__auftrag_stornieren',
          child_fields: [
            {
              id: 11854345857948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'geraetewesen__aufgabe_erteilen__auftragsgrund_ermitteln',
          child_fields: [
            {
              id: 11854345857948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'geraetewesen__aufgabe_erteilen__sachschaden_messtechnik',
          child_fields: [
            {
              id: 11854330210204,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
            {
              id: 11854344675484,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'geraetewesen__aufgabe_erteilen__termin__auftragsstatus_klaeren',
          child_fields: [
            {
              id: 11854345857948,
              is_required: false,
              required_on_statuses: { type: 'NO_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111951260,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854154967708,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/11854362599836.json',
      name: 'KK::NK::Gerätewesen',
      display_name: '',
      created_at: '2023-12-20T15:55:30Z',
      updated_at: '2024-04-08T15:02:18Z',
    },
    {
      id: 11854362594844,
      raw_name: 'KK::NK::Rechnungswesen',
      raw_display_name: '',
      end_user_visible: false,
      position: 13,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 11854326643996,
        10484199315740, 10484259036060, 11854376632220, 11854111953564, 11854111951260, 11854154967708, 11854111915164,
        11854120778908, 11854135703324, 12943563037212, 12943563037084, 11854152783004, 11854111960604, 12415932455708,
        11854360446748, 11854326644252, 11854346326172, 11854379700124, 11854326649628, 11854330320668, 11854332897436,
        11854326650012, 12353986986908, 12353982093212, 11854360419868, 11854326643356, 11854318503324, 11854169279900,
        11854326509212, 11854360344220, 11854360341788, 11854344589596, 11854152744092, 11854119970332, 11854152744348,
        11854152744476, 11854111889564, 11854361283868, 13445708966172, 13573341015964,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 11854154967708,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 11854111915164,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854111951260,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854154967708,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'rechnungswesen__aufgabe_erteilen__lastschriftmandat_einrichten',
          child_fields: [
            {
              id: 11854326649628,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'rechnungswesen__aufgabe_erteilen__ratenzahlung_einstellen',
          child_fields: [
            {
              id: 11854330320668,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'rechnungswesen__aufgabe_erteilen__storno_vertriebsrechnung_mit_lgnr',
          child_fields: [
            {
              id: 11854330320668,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'rechnungswesen__aufgabe_erteilen__storno_vertriebsrechnung_ohne_lgnr',
          child_fields: [
            {
              id: 11854330320668,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'rechnungswesen__information_einholen_weitergeben__zu_buchhaltungsthemen',
          child_fields: [
            {
              id: 11854330320668,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'rechnungswesen__information_einholen_weitergeben__zu_mahn-_und_klage_themen',
          child_fields: [
            {
              id: 11854330320668,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['solved'],
              },
            },
          ],
        },
      ],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/11854362594844.json',
      name: 'KK::NK::Rechnungswesen',
      display_name: '',
      created_at: '2023-12-20T15:55:30Z',
      updated_at: '2024-05-03T15:02:16Z',
    },
    {
      id: 11854347786012,
      raw_name: 'KK::NK::Vertragswesen',
      raw_display_name: '',
      end_user_visible: false,
      position: 14,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 11854326643996,
        10484199315740, 10484259036060, 11854376632220, 11854111953564, 11854111951260, 11854154967708, 11854111915164,
        11854135703324, 12943563037212, 12943563037084, 11854152783004, 11854346326172, 11854379700124, 11854318428188,
        11854120778908, 12415932455708, 11854360446748, 11854326644252, 11854318428828, 11854326524316, 11854330189084,
        11854330191900, 11854330189980, 12353986986908, 12353982093212, 11854360419868, 11854326643356, 11854318503324,
        11854330190108, 11854330202524, 11854360350364, 11854330188956, 11854330189596, 11854318446108, 11854326509212,
        11854360344220, 11854360341788, 11854344589596, 11854169279900, 11854152744092, 11854119970332, 11854152744348,
        11854152744476, 11854111889564, 11854361283868, 13445708966172, 13573341015964,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 11854111951260,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854154967708,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854154967708,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 11854111915164,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
      ],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/11854347786012.json',
      name: 'KK::NK::Vertragswesen',
      display_name: '',
      created_at: '2023-12-20T15:55:30Z',
      updated_at: '2024-05-03T15:02:16Z',
    },
    {
      id: 11854388205212,
      raw_name: 'KK::NK::Vorgang komplett übergeben',
      raw_display_name: '',
      end_user_visible: false,
      position: 15,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 11854326643996,
        10484199315740, 10484259036060, 11854376632220, 11854111953564, 11854111951260, 11854154967708, 11854111915164,
        11854120778908, 11854135703324, 12943563037212, 12943563037084, 11854152783004, 11854318508572, 12415932455708,
        11854360446748, 11854326644252, 11854346326172, 11854379700124, 11854318540956, 11854377313564, 11854327782044,
        11854362557340, 11854330320156, 12353986986908, 12353982093212, 11854360419868, 11854326643356, 11854318503324,
        11854169279900, 11854326509212, 11854360344220, 11854360341788, 11854344589596, 11854152744092, 11854119970332,
        11854152744348, 11854152744476, 11854111889564, 11854361283868, 13445708966172, 13573341015964,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [
        {
          parent_field_id: 11854111951260,
          parent_field_type: 'checkbox',
          value: true,
          child_fields: [
            {
              id: 11854154967708,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854154967708,
          parent_field_type: 'tagger',
          value: 'beschwerdegrad_schwerwiegend',
          child_fields: [
            {
              id: 11854111915164,
              is_required: true,
              required_on_statuses: { type: 'ALL_STATUSES' },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'vorgang_komplett_uebergeben__nutzeranfrage',
          child_fields: [
            {
              id: 11854318508572,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['hold', 'solved'],
              },
            },
          ],
        },
        {
          parent_field_id: 11854326643996,
          parent_field_type: 'tagger',
          value: 'vorgang_komplett_uebergeben__nutzerbeschwerde',
          child_fields: [
            {
              id: 11854318508572,
              is_required: true,
              required_on_statuses: {
                type: 'SOME_STATUSES',
                statuses: ['hold', 'solved'],
              },
            },
          ],
        },
      ],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/11854388205212.json',
      name: 'KK::NK::Vorgang komplett übergeben',
      display_name: '',
      created_at: '2023-12-20T15:55:30Z',
      updated_at: '2024-05-03T15:02:16Z',
    },
    {
      id: 12943568360732,
      raw_name: 'KK::NK::externe Kommunikation',
      raw_display_name: '',
      end_user_visible: false,
      position: 16,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 10484199315740,
        10484259036060, 11854376632220, 11854111953564, 11854120778908, 11854135703324, 12943563037212, 12943563037084,
        12353986986908, 12353982093212, 11854318503324, 11854169279900, 11854111889564, 11854360344220, 11854344589596,
        11854360341788, 11854326509212, 11854361283868, 13445708966172, 13573341015964,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/12943568360732.json',
      name: 'KK::NK::externe Kommunikation',
      display_name: '',
      created_at: '2024-03-06T00:13:38Z',
      updated_at: '2024-04-16T15:22:32Z',
    },
    {
      id: 13448686484764,
      raw_name: 'Adminformular',
      raw_display_name: '',
      end_user_visible: false,
      position: 17,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 10484213675932, 10484199312540, 12353986986908,
        12353982093212,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/13448686484764.json',
      name: 'Adminformular',
      display_name: '',
      created_at: '2024-04-08T15:02:18Z',
      updated_at: '2024-04-08T15:02:18Z',
    },
    {
      id: 14416197218460,
      raw_name: 'KK::QM::Stichprobenformular',
      raw_display_name: '',
      end_user_visible: false,
      position: 18,
      ticket_field_ids: [
        10484206104220, 10484244469276, 10484199321116, 10484213678492, 14416214038812, 11854111960604, 11854344772252,
        14416203105436, 14416214034588, 10484213675932, 10484199312540, 14416203102620, 14416188241564, 14416188241820,
        14416166616732, 14416188241052, 14416188248476, 14416203089692, 14416197147548, 14416203102364, 14416197143836,
        14416166611484, 12353986986908, 12353982093212,
      ],
      active: true,
      default: false,
      in_all_brands: true,
      restricted_brand_ids: [],
      end_user_conditions: [],
      agent_conditions: [],
      url: 'https://istase-int.zendesk.com/api/v2/ticket_forms/14416197218460.json',
      name: 'KK::QM::Stichprobenformular',
      display_name: '',
      created_at: '2024-06-11T15:35:19Z',
      updated_at: '2024-06-11T15:35:19Z',
    },
  ],
  next_page: null,
  previous_page: null,
  count: 19,
}

export type ClientOpts<TCredentials, TRateLimitConfig extends ClientRateLimitConfig> = {
  config?: ClientBaseConfig<TRateLimitConfig>
  connection?: Connection<TCredentials>
  credentials: TCredentials
}

export type ClientBaseParams = {
  url: string
  queryParams?: Record<string, string | string[]>
  headers?: Record<string, string>
  responseType?: ResponseType
}

export type ClientDataParams = ClientBaseParams & {
  data?: unknown
}

export type ClientParams = ClientBaseParams | ClientDataParams

export interface HTTPReadClientInterface<TAdditionalArgs = {}> {
  get(params: ClientBaseParams & TAdditionalArgs): Promise<Response<ResponseValue | ResponseValue[]>>
  head(params: ClientBaseParams & TAdditionalArgs): Promise<Response<ResponseValue | ResponseValue[]>>
  options(params: ClientBaseParams & TAdditionalArgs): Promise<Response<ResponseValue | ResponseValue[]>>
  getPageSize(): number
}

export interface HTTPWriteClientInterface<TAdditionalArgs = {}> {
  post(params: ClientDataParams & TAdditionalArgs): Promise<Response<ResponseValue | ResponseValue[]>>
  put(params: ClientDataParams & TAdditionalArgs): Promise<Response<ResponseValue | ResponseValue[]>>
  delete(params: ClientDataParams & TAdditionalArgs): Promise<Response<ResponseValue | ResponseValue[]>>
  patch(params: ClientDataParams & TAdditionalArgs): Promise<Response<ResponseValue | ResponseValue[]>>
}

export type HttpMethodToClientParams = {
  get: ClientBaseParams
  post: ClientDataParams
  put: ClientDataParams
  patch: ClientDataParams
  delete: ClientDataParams
  head: ClientBaseParams
  options: ClientBaseParams
}

type MethodsWithDataParam = 'put' | 'post' | 'patch'

export class HTTPError extends Error {
  constructor(
    message: string,
    readonly response: Response<ResponseValue>,
  ) {
    super(message)
  }
}

export class TimeoutError extends Error {}

export type ClientDefaults<TRateLimitConfig extends ClientRateLimitConfig> = {
  retry: Required<ClientRetryConfig>
  rateLimit: Required<TRateLimitConfig>
  maxRequestsPerMinute: number
  pageSize: Required<ClientPageSizeConfig>
  timeout?: ClientTimeoutConfig
}

const isMethodWithData = (params: ClientParams): params is ClientDataParams => 'data' in params

// Determines if the given HTTP method uses 'data' as the second parameter, based on APIConnection
const isMethodWithDataParam = <T extends keyof HttpMethodToClientParams>(
  method: T,
): method is T & MethodsWithDataParam => ['put', 'post', 'patch'].includes(method)

export abstract class AdapterHTTPClient<TCredentials, TRateLimitConfig extends ClientRateLimitConfig>
  extends AdapterClientBase<TRateLimitConfig>
  implements HTTPReadClientInterface, HTTPWriteClientInterface
{
  protected readonly conn: Connection<TCredentials>
  protected readonly credentials: TCredentials

  constructor(
    clientName: string,
    { credentials, connection, config }: ClientOpts<TCredentials, TRateLimitConfig>,
    createConnection: ConnectionCreator<TCredentials>,
    defaults: ClientDefaults<TRateLimitConfig>,
  ) {
    super(clientName, config, defaults)
    this.conn = createClientConnection({
      connection,
      retryOptions: createRetryOptions(
        _.defaults({}, this.config?.retry, defaults.retry),
        _.defaults({}, this.config?.timeout, defaults.timeout),
      ),
      timeout: this.config?.timeout?.maxDuration ?? defaults.timeout?.maxDuration ?? NO_TIMEOUT,
      createConnection,
    })
    this.credentials = credentials
  }

  protected async ensureLoggedIn(): Promise<void> {
    if (!this.isLoggedIn) {
      if (this.loginPromise === undefined) {
        this.loginPromise = this.conn.login(this.credentials)
      }
      const apiClient = await this.loginPromise
      if (this.apiClient === undefined) {
        this.apiClient = apiClient
        this.isLoggedIn = true
      }
    }
  }

  // eslint-disable-next-line class-methods-use-this
  protected clearValuesFromResponseData(responseData: Values, _url: string): Values {
    return responseData
  }

  /**
   * Extract headers needed by the adapter
   */
  // eslint-disable-next-line class-methods-use-this
  protected extractHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
    return headers !== undefined
      ? // include headers related to rate limits
        _.pickBy(
          headers,
          (_val, key) =>
            key.toLowerCase().startsWith('rate-') ||
            key.toLowerCase().startsWith('x-rate-') ||
            key.toLowerCase().startsWith('retry-'),
        )
      : undefined
  }

  /**
   * Get a single response
   */
  @throttle<TRateLimitConfig>({ bucketName: 'get', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async get(params: ClientBaseParams): Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('get', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'deploy', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async post(params: ClientDataParams): Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('post', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'deploy', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async put(params: ClientDataParams): Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('put', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'deploy', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async delete(params: ClientDataParams): Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('delete', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'deploy', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async patch(params: ClientDataParams): Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('patch', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'get', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async head(params: ClientBaseParams): Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('head', params)
  }

  @throttle<TRateLimitConfig>({ bucketName: 'get', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async options(params: ClientBaseParams): Promise<Response<ResponseValue | ResponseValue[]>> {
    return this.sendRequest('options', params)
  }

  protected async sendRequest<T extends keyof HttpMethodToClientParams>(
    method: T,
    params: HttpMethodToClientParams[T],
  ): Promise<Response<ResponseValue | ResponseValue[]>> {
    if (this.apiClient === undefined) {
      // initialized by requiresLogin (through ensureLoggedIn in this case)
      throw new Error(`uninitialized ${this.clientName} client`)
    }

    const { url, queryParams, headers, responseType } = params
    const data = isMethodWithData(params) ? params.data : undefined

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logResponse = (res: Response<any>, error?: any): void => {
      log.debug(
        'Received response for %s on %s (%s) with status %d',
        method.toUpperCase(),
        url,
        safeJsonStringify({ url, queryParams }),
        res.status,
      )

      const responseText = safeJsonStringify({
        url,
        method: method.toUpperCase(),
        status: res.status,
        queryParams,
        response: Buffer.isBuffer(res.data)
          ? `<omitted buffer of length ${res.data.length}>`
          : this.clearValuesFromResponseData(res.data, url),
        headers: this.extractHeaders(res.headers),
        data: Buffer.isBuffer(data) ? `<omitted buffer of length ${data.length}>` : data,
      })

      if (error === undefined) {
        log.trace(
          'Full HTTP response for %s on %s (size %d): %s',
          method.toUpperCase(),
          url,
          responseText.length,
          responseText,
        )
      } else {
        log.warn(`failed to ${method} ${url} with error: ${error}, stack: ${error.stack}, ${responseText}`)
      }
    }

    try {
      const requestConfig = [queryParams, headers, responseType].some(values.isDefined)
        ? {
            params: queryParams,
            headers,
            responseType,
          }
        : undefined

      const res = isMethodWithDataParam(method)
        ? await this.apiClient[method](url, isMethodWithData(params) ? params.data : undefined, requestConfig)
        : await this.apiClient[method](
            url,
            isMethodWithData(params) ? { ...requestConfig, data: params.data } : requestConfig,
          )

      logResponse(res)
      if (url.includes('ticket_forms')) {
        // eslint-disable-next-line no-console
        console.log('res:', res.data?.ticket_forms?.length)
        res.data.ticket_forms = dummyData.ticket_forms
      }
      if (url.includes('jhaskjasfhkjasfha')) {
        // eslint-disable-next-line no-console
        console.log(dummyData, dummy2)
      }
      return {
        data: res.data,
        status: res.status,
        headers: this.extractHeaders(res.headers),
      }
    } catch (e) {
      logResponse(
        {
          data: e?.response?.data ?? data,
          status: e?.response?.status ?? 'undefined',
          headers: e?.response?.headers ?? headers,
        },
        e,
      )
      if (e.code === 'ETIMEDOUT') {
        throw new TimeoutError(`Failed to ${method} ${url} with error: ${e}`)
      }
      if (e.response !== undefined) {
        throw new HTTPError(`Failed to ${method} ${url} with error: ${e}`, {
          status: e.response.status,
          data: e.response.data,
          headers: this.extractHeaders(e.response.headers),
        })
      }
      throw new Error(`Failed to ${method} ${url} with error: ${e}`)
    }
  }
}
