/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { oidcIdentityProviderValidator } from '../../src/change_validators/oidc_idp'
import { OKTA, IDENTITY_PROVIDER_TYPE_NAME } from '../../src/constants'

describe('oidcIdentityProviderValidator', () => {
  const idpType = new ObjectType({ elemID: new ElemID(OKTA, IDENTITY_PROVIDER_TYPE_NAME) })
  const clientSecretOIDCIdp = new InstanceElement('clientSecretOIDCIdp', idpType, {
    type: 'OIDC',
    status: 'ACTIVE',
    protocol: {
      type: 'OIDC',
      credentials: {
        client: {
          client_id: 'client_id',
        },
      },
    },
  })
  const privateKeyOIDCIdp = new InstanceElement('privateKeyOIDCIdp', idpType, {
    type: 'OIDC',
    status: 'ACTIVE',
    protocol: {
      type: 'OIDC',
      credentials: {
        client: {
          client_id: 'client_id',
          token_endpoint_auth_method: 'private_key_jwt',
        },
      },
    },
  })
  const samlIdp = new InstanceElement('samlIdp', idpType, {
    type: 'SAML2',
    status: 'ACTIVE',
    protocol: {
      type: 'SAML2',
    },
  })

  describe('addition changes', () => {
    it('should return an error in case of client secret OIDC idp addition', async () => {
      const changeErrors = await oidcIdentityProviderValidator([toChange({ after: clientSecretOIDCIdp })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors).toEqual([
        {
          elemID: clientSecretOIDCIdp.elemID,
          severity: 'Error',
          message: 'Can not deploy OIDC Identity Provider',
          detailedMessage: 'Operation is not supported for OIDC Identity Provider',
        },
      ])
    })
    it('should not return an error in case of private key OIDC idp addition', async () => {
      const changeErrors = await oidcIdentityProviderValidator([toChange({ after: privateKeyOIDCIdp })])
      expect(changeErrors).toHaveLength(0)
    })
    it('should not return an error in case of SAML idp addition', async () => {
      const changeErrors = await oidcIdentityProviderValidator([toChange({ after: samlIdp })])
      expect(changeErrors).toHaveLength(0)
    })
  })
  describe('modification changes', () => {
    it('should return an error in case of any OIDC idp modification', async () => {
      const changeErrors = await oidcIdentityProviderValidator([
        toChange({ before: privateKeyOIDCIdp, after: privateKeyOIDCIdp }),
        toChange({ before: clientSecretOIDCIdp, after: clientSecretOIDCIdp }),
      ])
      expect(changeErrors).toHaveLength(2)
      expect(changeErrors).toEqual([
        {
          elemID: privateKeyOIDCIdp.elemID,
          severity: 'Error',
          message: 'Can not deploy OIDC Identity Provider',
          detailedMessage: 'Operation is not supported for OIDC Identity Provider',
        },
        {
          elemID: clientSecretOIDCIdp.elemID,
          severity: 'Error',
          message: 'Can not deploy OIDC Identity Provider',
          detailedMessage: 'Operation is not supported for OIDC Identity Provider',
        },
      ])
    })

    it('should not return an error in case of SAML idp modification', async () => {
      const changeErrors = await oidcIdentityProviderValidator([toChange({ before: samlIdp, after: samlIdp })])
      expect(changeErrors).toHaveLength(0)
    })
  })
  describe('removal changes', () => {
    it('should not return an error in case of any idp removal', async () => {
      const changeErrors = await oidcIdentityProviderValidator([
        toChange({ before: privateKeyOIDCIdp }),
        toChange({ before: clientSecretOIDCIdp }),
        toChange({ before: samlIdp }),
      ])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
