import { InstanceElement } from 'adapter-api'

export default interface Credentials {
  get(adapter: string): Promise<InstanceElement | undefined>
  set(adapter: string, credentials: InstanceElement): Promise<void>
}
