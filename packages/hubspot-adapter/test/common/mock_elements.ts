/**
 * Forms Mock Instances
 */
const firstFormMock = {
  portalId: 6774238,
  guid: '3e2e7ef3-d0d4-418f-92e0-ad40ae2b622c',
  name: 'formTest1',
  action: '',
  method: 'POST',
  cssClass: 'abc',
  followUpId: 'DEPRECATED',
  editable: true,
  createdAt: 1571588456053,
  cloneable: true,
}

const secondFormMock = {
  portalId: 6774238,
  guid: '123e11f3-111-418f-92e0-cwwwe2b6999',
  name: 'formTest2',
  action: '',
  method: 'POST',
  cssClass: 'css',
  followUpId: 'DEPRECATED',
  editable: false,
  createdAt: 1561581451052,
  cloneable: true,
  captchaEnabled: false,
}

export const formsMockArray = [
  firstFormMock,
  secondFormMock,
] as unknown


/**
 * Workflow Mock Instances
 */
const firstWorkflowMock = {
  id: 12345,
  name: 'workflowTest1',
  type: 'DRIP_DELAY',
  unsupportedField: 'bla',
}

const secondWorkflowMock = {
  id: 54321,
  name: 'workflowTest1',
  type: 'DRIP_DELAY',
  enabled: false,
  contactListIds: {
    enrolled: 1,
    active: 2,
    completed: 3,
    succeeded: 4,

  },
}

export const workflowsMockArray = [
  firstWorkflowMock,
  secondWorkflowMock,
]


/**
 * MarketingEmail Mock Instances
 */
const firstMarketingEmailMock = {

  ab: true,
  abHoursToWait: 12,
  abVariation: false,
  abSampleSizeDefault: 'VARIANT',
  abSamplingDefault: 'MASTER',
  abStatus: 'MASTER',
  abSuccessMetric: 'OPENS_BY_DELIVERED',
  abTestId: '1234',
  abTestPercentage: 12345,
  absoluteUrl: 'google.com',
  allEmailCampaignIds: [],
  analyticsPageId: 'email ID',
  archived: 'archived',
  author: 'mail@gmail.com',
  authorEmail: 'mail123@gmail.com',
  authorName: 'userName',
  blogEmailType: 'daily',
  campaign: 'campaignID',
  campaignName: 'campaignName',
  canSpamSettingsId: 'id123',
  clonedFrom: 1234,
  createPage: false,
  created: 12334567,
  currentlyPublished: true,
  domain: 'ynet.com',
  emailBody: 'main email body',
  emailNote: 'email notes',
  emailType: 'AB_EMAIL',
  feedbackEmailCategory: 'CUSTOM',
  feedbackSurveyId: 1234,
  folderId: 999,
  freezeDate: 170456443,
  fromName: 'sender name',
  htmlTitle: 'title',
  id: 111111,
  isGraymailSuppressionEnabled: false,
  isLocalTimezoneSend: false,
  isPublished: true,
  name: 'marketingEmail instance name',
}

const secondMarketingEmailMock = {
  ab: false,
  abHoursToWait: 4,
  abVariation: false,
  abSampleSizeDefault: 'MASTER',
  abSamplingDefault: 'MASTER',
  abStatus: 'VARIANT',
  abSuccessMetric: 'OPENS_BY_DELIVERED',
  abTestId: '1234',
  abTestPercentage: 12345,
  absoluteUrl: 'google.com',
  allEmailCampaignIds: [],
  analyticsPageId: 'email ID',
  archived: 'archived',
  author: 'mail1@gmail.com',
  authorEmail: 'mail13@gmail.com',
  authorName: 'userNameOther',
  blogEmailType: 'daily',
  campaign: 'campaignID',
  campaignName: 'campaignName',
  canSpamSettingsId: 'id123',
  clonedFrom: 1234,
  createPage: true,
  created: 12334567,
  currentlyPublished: true,
  domain: 'one.com',
  emailBody: 'main body',
  emailNote: 'emails notes',
  emailType: 'ABC_EMAIL',
  feedbackEmailCategory: 'CUSTOM',
  feedbackSurveyId: 1234,
  folderId: 919,
  freezeDate: 170456443,
  fromName: 'sender name',
  htmlTitle: 'title',
  id: 222222,
  isGraymailSuppressionEnabled: true,
  isLocalTimezoneSend: true,
  isPublished: true,
  name: 'marketingEmail instance2 name',
}

const thirdMarketingEmailMock = {
  ab: false,
  abHoursToWait: 11,
  abVariation: false,
  abSampleSizeDefault: 'VARIANT',
  abSamplingDefault: 'MASTER',
  abStatus: 'VARIANT',
  abSuccessMetric: 'OPENS_BY_DELIVERED',
  abTestId: '6543',
  abTestPercentage: 12345,
  absoluteUrl: 'google.com',
  allEmailCampaignIds: [],
  analyticsPageId: 'email ID',
  archived: 'archived',
  author: 'mail,e@gmail.com',
  authorEmail: 'mail134@gmail.com',
  authorName: 'userNameOther1',
  blogEmailType: 'daily',
  campaign: 'campaignID',
  campaignName: 'campaignName',
  canSpamSettingsId: 'id123',
  clonedFrom: 1234,
  createPage: true,
  created: 12334567,
  currentlyPublished: true,
  domain: 'one.com',
  emailBody: 'main body',
  emailNote: 'emails notes',
  emailType: 'ABC_EMAIL',
  feedbackEmailCategory: 'CUSTOM',
  feedbackSurveyId: 111,
  folderId: 919,
  freezeDate: 170456443,
  fromName: 'sender name',
  htmlTitle: 'title',
  id: 973287,
  isGraymailSuppressionEnabled: true,
  isLocalTimezoneSend: true,
  isPublished: true,
  name: 'marketingEmail instance3 name',
}

export const marketingEmailMockArray = [
  firstMarketingEmailMock,
  secondMarketingEmailMock,
  thirdMarketingEmailMock,
]
