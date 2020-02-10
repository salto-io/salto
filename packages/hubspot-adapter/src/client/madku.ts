import {
  RequestPromise,
} from 'requestretry'

export interface Form extends HubspotObjectAPI {
  update(guid: string, data: {}): RequestPromise
}

export interface Workflow extends HubspotObjectAPI {
  get(workflowId: number): RequestPromise
  enroll(workflowId: number, email: string): RequestPromise
  unenroll(workflowId: number, email: string): RequestPromise
}

export interface MarketingEmail extends HubspotObjectAPI {
  update(id: string, data: {}): RequestPromise
}

interface ContactProperty extends HubspotObjectAPI {
  update(id: string, data: {}): RequestPromise
}

export interface Contact extends HubspotObjectAPI {
  get(opts?: {}): RequestPromise
  properties: ContactProperty
}

export interface HubspotObjectAPI {
  getAll(opts?: {}): RequestPromise
  create(data: {}): RequestPromise
  delete(id: string | number): RequestPromise
  update?(id: string | number, data: {}): RequestPromise
}

export default interface Connection {
  forms: Form
  workflows: Workflow
  marketingEmail: MarketingEmail
  contacts: Contact
}
