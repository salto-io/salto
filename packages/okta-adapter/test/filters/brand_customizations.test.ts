/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  TemplateExpression,
  isInstanceElement,
  CORE_ANNOTATIONS,
  StaticFile,
} from '@salto-io/adapter-api'
import { parserUtils } from '@salto-io/parser'
import { filterUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG } from '../../src/user_config'
import { getFilterParams } from '../utils'
import brandCustomizationsFilter from '../../src/filters/brand_customizations'
import {
  DOMAIN_TYPE_NAME,
  EMAIL_CUSTOMIZATION_TYPE_NAME,
  SIGN_IN_PAGE_TYPE_NAME,
  BRAND_TYPE_NAME,
  OKTA,
  EMAIL_TEMPLATE_TYPE_NAME,
} from '../../src/constants'

const getContentFieldType = (typeName: string): string =>
  typeName === EMAIL_CUSTOMIZATION_TYPE_NAME ? 'body' : 'pageContent'

describe('brandCustomizationsFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const domainType = new ObjectType({ elemID: new ElemID(OKTA, DOMAIN_TYPE_NAME) })
  const brandType = new ObjectType({ elemID: new ElemID(OKTA, BRAND_TYPE_NAME) })
  const emailTemplateType = new ObjectType({ elemID: new ElemID(OKTA, EMAIL_TEMPLATE_TYPE_NAME) })
  const emailCustomizationType = new ObjectType({ elemID: new ElemID(OKTA, EMAIL_CUSTOMIZATION_TYPE_NAME) })
  const signinPapeType = new ObjectType({ elemID: new ElemID(OKTA, SIGN_IN_PAGE_TYPE_NAME) })
  const brandInstance = new InstanceElement('brand', brandType, { name: 'brand', removePoweredByOkta: true })
  const domainInstance = new InstanceElement('domain', domainType, {
    domain: 'login2.example.com',
    certificateSourceType: 'MANUAL',
    brandId: new ReferenceExpression(brandInstance.elemID, brandInstance),
  })
  const emailTemplateInst = new InstanceElement(
    'ForgotPassword',
    emailTemplateType,
    { name: 'ForgotPassword' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brandInstance.elemID, brandInstance)] },
  )
  const contentWithParts = [
    `<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body>
<div style="background-color: \${brand.theme.secondaryColor}; margin: 0">
    <table style="font-family: 'Proxima Nova', 'Century Gothic', Arial, Verdana, sans-serif; font-size: 14px; color: #5e5e5e; width:98%; max-width: 600px; float: none; margin: 0 auto;" border="0" cellpadding="0" cellspacing="0" valign="top" align="left">
        <tr align="middle"><td style="padding-top: 30px; padding-bottom: 32px;"><img src="\${brand.theme.logo}" height="37"></td></tr>
        <tr bgcolor="#ffffff"><td>
            <table bgcolor="#ffffff" style="width: 100%; line-height: 20px; padding: 32px; border: 1px solid; border-color: #f0f0f0;" cellpadding="0">
                <tr>
                    <td style="color: #5e5e5e; font-size: 22px; line-height: 22px;">
                        \${org.name} - Okta Password Reset Requested
                    </td>
                </tr>
                 <tr>
                    <td style="width:100%; padding-right: 0px; padding-left: 0px;">
                        <div align="center" style="line-height:10px">
                            <img src="https://salto.`,
    'login2.example.com',
    `/salto/id/banner.png" style="display: block; height: auto; border: 0; max-width: 100%;" width="600">
                        </div>
                                                    </td>
                 </tr>
                <tr>
                    <td style="padding-top: 24px; vertical-align: bottom;">
                        Hi $!{StringTool.escapeHtml($!{user.profile.firstName})},
                    </td>
                </tr>
                <tr>
                    <td style="padding-top: 24px;">
                        A password reset request was made for your Okta account. If you did not make this request, please contact your system administrator immediately.
                    </td>
                </tr>
                <tr>
                    <td style="padding-top: 24px;">
                        At this time your password can only be reset by an administrator. To send them a request, go to your <a href="https://salto.`,
    'login2.example.com',
    `/salto/guide" style="color: #007dc1; text-decoration: none"><span style="color: #007dc1; text-decoration: none">Sign-in Help</span></a> page. Then click the Request help link.
                    </td>
                </tr>
            </table>
        </td></tr>
        <tr>
            <td style="font-size: 12px; padding: 16px 0 30px 50px; color: #999;">
                This is an automatically generated message from <a href="https://www.okta.com" style="color: rgb(97,97,97);">Okta</a>. Replies are not monitored or answered.
            </td>
        </tr>
    </table>
</div>
</body>
</html>`,
  ]
  const emailCustomizationInst = new InstanceElement(
    'ForgotPassword',
    emailCustomizationType,
    { subject: 'Account password reset', body: contentWithParts.join(''), language: 'en' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(emailTemplateInst.elemID, emailTemplateInst)] },
  )
  const signinPageInst = new InstanceElement(
    'signin',
    signinPapeType,
    { pageContent: contentWithParts.join(''), widgetVersion: '^7' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brandInstance.elemID, brandInstance)] },
  )
  const types = [domainType, brandType, emailTemplateType, emailCustomizationType, signinPapeType]

  describe('when enableBrandReferences is disabled', () => {
    beforeEach(() => {
      filter = brandCustomizationsFilter(getFilterParams({ config: DEFAULT_CONFIG })) as typeof filter
    })

    it('should not change content field', async () => {
      const elements = [
        ...types,
        signinPageInst,
        emailCustomizationInst,
        emailTemplateInst,
        domainInstance,
        brandInstance,
      ]
      const beforeInstances = elements
        .filter(isInstanceElement)
        .filter(
          inst =>
            inst.elemID.typeName === EMAIL_CUSTOMIZATION_TYPE_NAME || inst.elemID.typeName === SIGN_IN_PAGE_TYPE_NAME,
        )
        .map(inst => inst.clone())
      await filter.onFetch(elements)
      elements.filter(isInstanceElement).forEach(inst => {
        const fieldName = getContentFieldType(inst.elemID.typeName)
        const beforeContent = beforeInstances.find(e => e.elemID.isEqual(inst.elemID))?.value[fieldName]
        const afterContent = inst.value[fieldName]
        expect(afterContent).toEqual(beforeContent)
      })
    })
  })

  describe('when enableBrandReferences is enabled', () => {
    beforeEach(() => {
      filter = brandCustomizationsFilter(
        getFilterParams({
          config: { ...DEFAULT_CONFIG, fetch: { ...DEFAULT_CONFIG.fetch, enableBrandReferences: true } },
        }),
      ) as typeof filter
    })

    it('should create static file from content with references to domain', async () => {
      const elements = [...types, signinPageInst, emailCustomizationInst, domainInstance, brandInstance].map(e =>
        e.clone(),
      )
      await filter.onFetch(elements)
      const emailCustomization = elements
        .filter(isInstanceElement)
        .find(inst => inst.elemID.typeName === EMAIL_CUSTOMIZATION_TYPE_NAME)
      const emailContent = emailCustomization?.value[getContentFieldType(EMAIL_CUSTOMIZATION_TYPE_NAME)]
      expect(emailContent).toBeInstanceOf(StaticFile)
      expect(emailContent.isTemplate).toBeTruthy()
      expect(await parserUtils.staticFileToTemplateExpression(emailContent)).toEqual(
        new TemplateExpression({
          parts: contentWithParts.map(p =>
            p === 'login2.example.com' ? new ReferenceExpression(domainInstance.elemID) : p,
          ),
        }),
      )
      expect(emailContent.filepath).toEqual('okta/brand/EmailCustomization/ForgotPassword.html')

      const signinPage = elements
        .filter(isInstanceElement)
        .find(inst => inst.elemID.typeName === SIGN_IN_PAGE_TYPE_NAME)
      const pageContent = signinPage?.value[getContentFieldType(SIGN_IN_PAGE_TYPE_NAME)]
      expect(pageContent).toBeInstanceOf(StaticFile)
      expect(pageContent.isTemplate).toBeTruthy()
      expect(await parserUtils.staticFileToTemplateExpression(pageContent)).toEqual(
        new TemplateExpression({
          parts: contentWithParts.map(p =>
            p === 'login2.example.com' ? new ReferenceExpression(domainInstance.elemID) : p,
          ),
        }),
      )
      expect(pageContent.filepath).toEqual('okta/brand/SignInPage/signin.html')
    })

    it('should create a static file for content field, also when no reference found', async () => {
      const updatedContent = contentWithParts.map(p => (p === 'login2.example.com' ? 'other.com' : p))
      const clonedEmailCustomizationInst = emailCustomizationInst.clone()
      clonedEmailCustomizationInst.value[getContentFieldType(EMAIL_CUSTOMIZATION_TYPE_NAME)] = updatedContent.join('')
      const elements = [...types, clonedEmailCustomizationInst, emailTemplateInst, domainInstance, brandInstance].map(
        e => e.clone(),
      )
      await filter.onFetch(elements)
      const emailCustomization = elements
        .filter(isInstanceElement)
        .find(inst => inst.elemID.typeName === EMAIL_CUSTOMIZATION_TYPE_NAME)
      const emailContent = emailCustomization?.value[getContentFieldType(EMAIL_CUSTOMIZATION_TYPE_NAME)]
      expect(emailContent).toBeInstanceOf(StaticFile)
      expect(emailContent.isTemplate).toBeFalsy()
      expect(emailContent.filepath).toEqual('okta/brand/EmailCustomization/ForgotPassword.html')
    })

    it('should not extract reference from content, when there is more than one domain matching the brand', async () => {
      const anotherDomain = new InstanceElement('domain2', domainType, {
        domain: 'login3.example.com',
        brandId: new ReferenceExpression(brandInstance.elemID, brandInstance),
      })
      const elements = [
        ...types,
        signinPageInst,
        emailCustomizationInst,
        domainInstance,
        brandInstance,
        anotherDomain,
      ].map(e => e.clone())
      await filter.onFetch(elements)
      const emailCustomization = elements
        .filter(isInstanceElement)
        .find(inst => inst.elemID.typeName === EMAIL_CUSTOMIZATION_TYPE_NAME)
      const emailContent = emailCustomization?.value[getContentFieldType(EMAIL_CUSTOMIZATION_TYPE_NAME)]
      expect(emailContent).toBeInstanceOf(StaticFile)
      expect(emailContent.isTemplate).toBeFalsy()

      const signinPage = elements
        .filter(isInstanceElement)
        .find(inst => inst.elemID.typeName === SIGN_IN_PAGE_TYPE_NAME)
      const pageContent = signinPage?.value[getContentFieldType(SIGN_IN_PAGE_TYPE_NAME)]
      expect(pageContent).toBeInstanceOf(StaticFile)
      expect(pageContent.isTemplate).toBeFalsy()
    })

    it('should do nothing when there is not content field', async () => {
      const clonedSigninPageInst = signinPageInst.clone()
      delete clonedSigninPageInst.value[getContentFieldType(SIGN_IN_PAGE_TYPE_NAME)]
      const elements = [...types, clonedSigninPageInst, domainInstance, brandInstance]
      await filter.onFetch(elements)
      const signinPage = elements
        .filter(isInstanceElement)
        .find(inst => inst.elemID.typeName === SIGN_IN_PAGE_TYPE_NAME)
      expect(signinPage?.value).toEqual(clonedSigninPageInst.value)
    })
  })
})
