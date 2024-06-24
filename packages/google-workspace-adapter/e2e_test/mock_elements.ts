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
import { GROUP_TYPE_NAME, ROLE_TYPE_NAME, SCHEMA_TYPE_NAME } from '../src/constants'

export const mockDefaultValues: Record<string, Values> = {
  [GROUP_TYPE_NAME]: {
    email: 'testgroup@e2e.salto-internal-test.com',
    name: 'TestGroup',
    description: 'test test',
    groupSettings: {
      whoCanJoin: 'CAN_REQUEST_TO_JOIN',
      whoCanViewMembership: 'ALL_MEMBERS_CAN_VIEW',
      whoCanViewGroup: 'ALL_MEMBERS_CAN_VIEW',
      whoCanInvite: 'ALL_MANAGERS_CAN_INVITE',
      whoCanAdd: 'ALL_MANAGERS_CAN_ADD',
      allowExternalMembers: 'false',
      whoCanPostMessage: 'ANYONE_CAN_POST',
      allowWebPosting: 'true',
      primaryLanguage: 'en_US',
      maxMessageBytes: 26214400,
      isArchived: 'false',
      archiveOnly: 'false',
      messageModerationLevel: 'MODERATE_NONE',
      spamModerationLevel: 'MODERATE',
      replyTo: 'REPLY_TO_IGNORE',
      includeCustomFooter: 'false',
      customFooterText: '',
      sendMessageDenyNotification: 'false',
      defaultMessageDenyNotificationText: '',
      showInGroupDirectory: 'true',
      allowGoogleCommunication: 'false',
      membersCanPostAsTheGroup: 'false',
      messageDisplayFont: 'DEFAULT_FONT',
      includeInGlobalAddressList: 'true',
      whoCanLeaveGroup: 'ALL_MEMBERS_CAN_LEAVE',
      whoCanContactOwner: 'ANYONE_CAN_CONTACT',
      whoCanAddReferences: 'NONE',
      whoCanAssignTopics: 'NONE',
      whoCanUnassignTopic: 'NONE',
      whoCanTakeTopics: 'NONE',
      whoCanMarkDuplicate: 'NONE',
      whoCanMarkNoResponseNeeded: 'NONE',
      whoCanMarkFavoriteReplyOnAnyTopic: 'NONE',
      whoCanMarkFavoriteReplyOnOwnTopic: 'NONE',
      whoCanUnmarkFavoriteReplyOnAnyTopic: 'NONE',
      whoCanEnterFreeFormTags: 'NONE',
      whoCanModifyTagsAndCategories: 'NONE',
      favoriteRepliesOnTop: 'true',
      whoCanApproveMembers: 'ALL_MANAGERS_CAN_APPROVE',
      whoCanBanUsers: 'OWNERS_AND_MANAGERS',
      whoCanModifyMembers: 'OWNERS_AND_MANAGERS',
      whoCanApproveMessages: 'OWNERS_AND_MANAGERS',
      whoCanDeleteAnyPost: 'OWNERS_AND_MANAGERS',
      whoCanDeleteTopics: 'OWNERS_AND_MANAGERS',
      whoCanLockTopics: 'OWNERS_AND_MANAGERS',
      whoCanMoveTopicsIn: 'OWNERS_AND_MANAGERS',
      whoCanMoveTopicsOut: 'OWNERS_AND_MANAGERS',
      whoCanPostAnnouncements: 'OWNERS_AND_MANAGERS',
      whoCanHideAbuse: 'NONE',
      whoCanMakeTopicsSticky: 'NONE',
      whoCanModerateMembers: 'OWNERS_AND_MANAGERS',
      whoCanModerateContent: 'OWNERS_AND_MANAGERS',
      whoCanAssistContent: 'NONE',
      customRolesEnabledForSettingsToBeMerged: 'false',
      enableCollaborativeInbox: 'false',
      whoCanDiscoverGroup: 'ALL_IN_DOMAIN_CAN_DISCOVER',
      defaultSender: 'DEFAULT_SELF',
    },
    labels: {
      'cloudidentity_googleapis_com_groups_security@vvdv': '',
      'cloudidentity_googleapis_com_groups_discussion_forum@vvdvu': '',
    },
  },
  [ROLE_TYPE_NAME]: {
    roleName: 'testRole',
    roleDescription: 'demo',
    rolePrivileges: [
      {
        privilegeName: 'ORGANIZATION_UNITS_CREATE',
        serviceId: '00haapch16h1ysv',
      },
      {
        privilegeName: 'ORGANIZATION_UNITS_DELETE',
        serviceId: '00haapch16h1ysv',
      },
      {
        privilegeName: 'ORGANIZATION_UNITS_RETRIEVE',
        serviceId: '00haapch16h1ysv',
      },
      {
        privilegeName: 'ORGANIZATION_UNITS_ALL',
        serviceId: '00haapch16h1ysv',
      },
      {
        privilegeName: 'ORGANIZATION_UNITS_UPDATE',
        serviceId: '00haapch16h1ysv',
      },
      {
        privilegeName: 'USERS_ADD_NICKNAME',
        serviceId: '00haapch16h1ysv',
      },
      {
        privilegeName: 'USERS_CREATE',
        serviceId: '00haapch16h1ysv',
      },
      {
        privilegeName: 'USERS_DELETE',
        serviceId: '00haapch16h1ysv',
      },
      {
        privilegeName: 'USERS_FORCE_PASSWORD_CHANGE',
        serviceId: '00haapch16h1ysv',
      },
      {
        privilegeName: 'USERS_RETRIEVE',
        serviceId: '00haapch16h1ysv',
      },
      {
        privilegeName: 'USERS_ALL',
        serviceId: '00haapch16h1ysv',
      },
      {
        privilegeName: 'USERS_MOVE',
        serviceId: '00haapch16h1ysv',
      },
      {
        privilegeName: 'USERS_ALIAS',
        serviceId: '00haapch16h1ysv',
      },
      {
        privilegeName: 'USERS_RESET_PASSWORD',
        serviceId: '00haapch16h1ysv',
      },
      {
        privilegeName: 'USERS_SUSPEND',
        serviceId: '00haapch16h1ysv',
      },
      {
        privilegeName: 'USERS_UPDATE',
        serviceId: '00haapch16h1ysv',
      },
      {
        privilegeName: 'USERS_UPDATE_CUSTOM_ATTRIBUTES_USER_PRIVILEGE_GROUP',
        serviceId: '00haapch16h1ysv',
      },
    ],
  },
  [SCHEMA_TYPE_NAME]: {
    schemaName: 'TestSchema',
    displayName: 'Test displayyy',
    fields: {
      roles: {
        fieldType: 'STRING',
        fieldName: 'roles',
        displayName: 'roles',
        readAccessType: 'ALL_DOMAIN_USERS',
      },
    },
  },
}
