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
export const WITH_POST_FUNCTIONS = {
  transitions: [
    {
      rules: {
        postFunctions: [
          {
            type: 'FireIssueEventFunction',
            configuration: {
              event: {
                id: '1',
                name: 'name',
              },
            },
          },
          {
            type: 'FireIssueEventFunction',
            configuration: {
            },
          },
          {
            type: 'FireIssueEventFunction',
          },
          {
            type: 'SetIssueSecurityFromRoleFunction',
            configuration: {
              projectRole: {
                id: '1',
                name: 'name',
              },
            },
          },
          {
            type: 'SetIssueSecurityFromRoleFunction',
            configuration: {
            },
          },
          {
            type: 'SetIssueSecurityFromRoleFunction',
          },
        ],
      },
    },
  ],
}

export const EXPECTED_POST_FUNCTIONS = {
  rules: {
    postFunctions: [
      {
        type: 'FireIssueEventFunction',
        configuration: {
          event: {
            id: '1',
          },
        },
      },
      {
        type: 'FireIssueEventFunction',
        configuration: {},
      },
      {
        type: 'FireIssueEventFunction',
      },

      {
        type: 'SetIssueSecurityFromRoleFunction',
        configuration: {
          projectRole: {
            id: '1',
          },
        },
      },
      {
        type: 'SetIssueSecurityFromRoleFunction',
        configuration: {
        },
      },
      {
        type: 'SetIssueSecurityFromRoleFunction',
      },
    ],
  },
}

export const WITH_UNSUPPORTED_POST_FUNCTIONS = {
  transitions: [
    {
      type: 'initial',
      rules: {
        postFunctions: [
          { type: 'AssignToCurrentUserFunction' },
          { type: 'UpdateIssueStatusFunction' },
          { type: 'unsupported' },
        ],
      },
    },
    {
      type: 'global',
      rules: {
        postFunctions: [
          { type: 'AssignToCurrentUserFunction' },
          { type: 'UpdateIssueStatusFunction' },
          { type: 'unsupported' },
        ],
      },
    },
  ],
}

export const WITH_VALIDATORS = {
  transitions: [
    {
      rules: {
        validators: [
          {
            type: 'ParentStatusValidator',
            configuration: {
              parentStatuses: [{
                id: '1',
                name: 'name',
              }],
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
  transitions: [
    {
      type: 'initial',
      rules: {
        validators: [
          {
            type: 'PermissionValidator',
            configuration: {
              permissionKey: 'CREATE_ISSUES',
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
            type: 'PermissionValidator',
            configuration: {
              permissionKey: 'CREATE_ISSUES',
            },
          },
          {
            type: 'PermissionValidator',
            configuration: {
              permissionKey: 'OTHER',
            },
          },
        ],
      },
    },
  ],
}

export const WITH_SCRIPT_RUNNERS = {
  transitions: [
    {
      rules: {
        validators: [
          {
            type: 'com.onresolve.jira.groovy.groovyrunner__script-workflow-validators',
          },
          {
            type: 'other',
          },
          {
            val: 'val',
          },
        ],
        postFunctions: [
          {
            type: 'com.onresolve.jira.groovy.groovyrunner__script-postfunction',
          },
          {
            type: 'other',
          },
          {
            val: 'val',
          },
        ],
      },
    },
  ],
}
