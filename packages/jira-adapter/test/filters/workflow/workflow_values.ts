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
import { INITIAL_VALIDATOR } from '../../../src/filters/workflow/workflow_deploy_filter'

export const WITH_UNSUPPORTED_POST_FUNCTIONS = {
  transitions: [
    {
      name: 'tran1',
      type: 'initial',
      rules: {
        postFunctions: [
          { type: 'AssignToCurrentUserFunction' },
          { type: 'UpdateIssueStatusFunction' },
          { type: 'GenerateChangeHistoryFunction' },
          {},
        ],
      },
    },
    {
      name: 'tran2',
      type: 'global',
      rules: {
        postFunctions: [
          { type: 'AssignToCurrentUserFunction' },
          { type: 'UpdateIssueStatusFunction' },
          { type: 'GenerateChangeHistoryFunction' },
          {},
        ],
      },
    },
  ],
}

export const WITH_VALIDATORS = {
  transitions: [
    {
      name: 'tran1',
      rules: {
        validators: [
          {
            type: 'ParentStatusValidator',
            configuration: {
              parentStatuses: [
                {
                  id: '1',
                  name: 'name',
                },
              ],
            },
          },
          {
            type: 'PreviousStatusValidator',
            configuration: {
              previousStatus: {
                id: '1',
                name: 'name',
              },
            },
          },
          {
            type: 'PreviousStatusValidator',
          },
        ],
      },
    },
  ],
}

export const WITH_PERMISSION_VALIDATORS = {
  name: 'name',
  transitions: {
    'tran1__From__none__Initial@fffsff': {
      name: 'tran1',
      type: 'initial',
      rules: {
        validators: [
          INITIAL_VALIDATOR,
          {
            type: 'PreviousStatusValidator',
            configuration: {
              previousStatus: {
                id: '1',
                name: 'name',
              },
            },
          },
          INITIAL_VALIDATOR,
          {
            type: 'PermissionValidator',
            configuration: {
              permissionKey: 'OTHER',
            },
          },
        ],
      },
    },
  },
}
