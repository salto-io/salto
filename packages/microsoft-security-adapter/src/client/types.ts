/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

export const AVAILABLE_MICROSOFT_SECURITY_SERVICES = ['Entra', 'Intune'] as const
export type AvailableMicrosoftSecurityServices = (typeof AVAILABLE_MICROSOFT_SECURITY_SERVICES)[number]

export type OauthRequestParameters = {
  tenantId: string
  clientId: string
  clientSecret: string
  port: number
} & Record<AvailableMicrosoftSecurityServices, boolean>

export type Credentials = Omit<OauthRequestParameters, 'port' | AvailableMicrosoftSecurityServices> & {
  refreshToken: string
  servicesToManage: AvailableMicrosoftSecurityServices[]
}
