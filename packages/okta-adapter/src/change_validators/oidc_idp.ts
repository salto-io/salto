/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  InstanceElement,
  Change,
  isModificationChange,
  isAdditionChange,
} from '@salto-io/adapter-api'
import { IDENTITY_PROVIDER_TYPE_NAME } from '../constants'

const OIDC_IDP_TYPE = 'OIDC'
const IDP_PROTOCOL_TYPE_PATH = ['protocol', 'type']
const AUTH_METHOD_PATH = ['protocol', 'credentials', 'client', 'token_endpoint_auth_method']

const isOIDCIdentityProvider = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === IDENTITY_PROVIDER_TYPE_NAME &&
  _.get(instance.value, IDP_PROTOCOL_TYPE_PATH) === OIDC_IDP_TYPE

const isModificationOfOIDCIdentityProvider = (change: Change<InstanceElement>): boolean =>
  isModificationChange(change) && isOIDCIdentityProvider(getChangeData(change))

const isAdditionOfClientOIDCIdentityProvider = (change: Change<InstanceElement>): boolean =>
  isAdditionChange(change) &&
  isOIDCIdentityProvider(getChangeData(change)) &&
  _.get(getChangeData(change).value, AUTH_METHOD_PATH) !== 'private_key_jwt'

/**
 * Block additions of OIDC identity provider with client_secret auth method,
 * and modifications of any OIDC identity provider, as we currently do not support it.
 */
export const oidcIdentityProviderValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(change => isAdditionOfClientOIDCIdentityProvider(change) || isModificationOfOIDCIdentityProvider(change))
    .map(change => ({
      elemID: getChangeData(change).elemID,
      severity: 'Error',
      message: 'Can not deploy OIDC Identity Provider',
      detailedMessage: 'Operation is not supported for OIDC Identity Provider',
    }))
