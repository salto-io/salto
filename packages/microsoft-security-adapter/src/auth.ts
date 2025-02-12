/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, ElemID, ObjectType } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { MICROSOFT_SECURITY } from './constants'

export const AVAILABLE_MICROSOFT_SECURITY_SERVICES = ['Entra', 'Intune'] as const
export type AvailableMicrosoftSecurityServices = (typeof AVAILABLE_MICROSOFT_SECURITY_SERVICES)[number]
export type MicrosoftServicesToManage = Partial<Record<AvailableMicrosoftSecurityServices, boolean>>

type OauthRequestParameters = {
  tenantId: string
  clientId: string
  clientSecret: string
  port: number
} & Required<MicrosoftServicesToManage>

export type Credentials = Omit<OauthRequestParameters, 'port' | AvailableMicrosoftSecurityServices> & {
  refreshToken: string
  servicesToManage: MicrosoftServicesToManage
}

export const BASIC_OAUTH_REQUIRED_SCOPES = ['Group.ReadWrite.All']
export const SCOPE_MAPPING: Record<AvailableMicrosoftSecurityServices, string[]> = {
  Entra: [
    'AdministrativeUnit.ReadWrite.All',
    'Application.ReadWrite.All',
    'AppRoleAssignment.ReadWrite.All',
    'CustomSecAttributeDefinition.ReadWrite.All',
    'Directory.ReadWrite.All',
    'Domain.ReadWrite.All',
    'Policy.Read.All',
    'Policy.ReadWrite.AuthenticationMethod',
    'Policy.ReadWrite.ConditionalAccess',
    'Policy.ReadWrite.PermissionGrant',
    'RoleManagement.ReadWrite.Directory',
    'UserAuthenticationMethod.ReadWrite.All',
  ],
  Intune: [
    'DeviceManagementApps.ReadWrite.All',
    'DeviceManagementConfiguration.ReadWrite.All',
    'DeviceManagementRBAC.ReadWrite.All',
    'User.Read',
  ],
}

// Deprecated. This list should not be used as-is. Use getOAuthRequiredScopes instead.
// We are keeping it until its usage is removed from the dependent code.
export const OAUTH_REQUIRED_SCOPES = [...BASIC_OAUTH_REQUIRED_SCOPES, ...Object.values(SCOPE_MAPPING).flat()]

export const oauthRequestParameters = createMatchingObjectType<OauthRequestParameters>({
  elemID: new ElemID(MICROSOFT_SECURITY),
  fields: {
    tenantId: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Tenant ID',
        _required: true,
      },
    },
    clientId: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Client ID',
        _required: true,
      },
    },
    clientSecret: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Client Secret',
        _required: true,
      },
    },
    port: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        message: 'Port',
        _required: true,
      },
    },
    Entra: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
        message: 'Manage Entra?',
        _required: true,
      },
    },
    Intune: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
        message: 'Manage Intune?',
        _required: true,
      },
    },
  },
})

export const credentialsType = createMatchingObjectType<Credentials>({
  elemID: new ElemID(MICROSOFT_SECURITY),
  fields: {
    tenantId: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true, message: 'Tenant ID' },
    },
    clientId: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true, message: 'Client ID' },
    },
    clientSecret: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true, message: 'Client Secret' },
    },
    refreshToken: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true, message: 'Refresh Token' },
    },
    servicesToManage: {
      refType: new ObjectType({
        elemID: new ElemID(MICROSOFT_SECURITY, 'servicesToManage'),
        fields: Object.fromEntries(
          AVAILABLE_MICROSOFT_SECURITY_SERVICES.map(service => [
            service,
            { refType: BuiltinTypes.BOOLEAN, annotations: { message: `Manage ${service}?` } },
          ]),
        ),
      }),
      annotations: { _required: true, message: 'List of Microsoft Security services to manage' },
    },
  },
})
