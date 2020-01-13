import {
  RequestPromise,
} from 'requestretry'

export interface Form {
  getAll(opts?: {}): RequestPromise
  create(data: {}): RequestPromise
  update(guid: string, data: {}): RequestPromise
  delete(guid: string): RequestPromise
}

export interface Workflow {
  getAll(opts?: {}): RequestPromise
  enroll(workflowId: number, email: string): RequestPromise
  unenroll(workflowId: number, email: string): RequestPromise
}

export interface Contact {
  getAll(opts?: {}): RequestPromise
  get(opts?: {}): RequestPromise
}

export default interface Connection {
  forms: Form
  workflows: Workflow
  contacts: Contact
}
