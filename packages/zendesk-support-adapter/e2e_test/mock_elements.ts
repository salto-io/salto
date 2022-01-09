/*
*                      Copyright 2021 Salto Labs Ltd.
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
// "automation",
//     "brand",
//     "business_hours_schedule",
//     "custom_role",
//     "dynamic_content_item",

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
    position: 10000,
  },
}
