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

const isModificationOfOIDCIdentityProvider = (change: Change<InstanceElement>): boolean =>
  isModificationChange(change) &&
  getChangeData(change).elemID.typeName === IDENTITY_PROVIDER_TYPE_NAME &&
  _.get(getChangeData(change).value, IDP_PROTOCOL_TYPE_PATH) === OIDC_IDP_TYPE

const isAdditionOfClientOIDCIdentityProvider = (change: Change<InstanceElement>): boolean =>
  isAdditionChange(change) &&
  getChangeData(change).elemID.typeName === IDENTITY_PROVIDER_TYPE_NAME &&
  _.get(getChangeData(change).value, IDP_PROTOCOL_TYPE_PATH) === OIDC_IDP_TYPE &&
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
