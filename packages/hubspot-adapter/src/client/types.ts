export interface HubspotMetadata {
  name: string
  // TODO
}

export interface Form extends HubspotMetadata {
  guid: string
  method: string
  cssClass: string
  redirect: string
  submitText: string
  notifyRecipients: string
  ignoreCurrentValues: boolean
  deletable: boolean
  inlineMessage: string
  createdAt: number
  captchaEnabled: boolean
  cloneable: boolean
  editable: boolean
}
