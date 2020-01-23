export const BP_EXTENSION = '.bp'

export type Blueprint = {
  buffer: string
  filename: string
  timestamp?: number
}

export default interface BlueprintsStore {
  list(): Promise<string[]>
  get(filename: string): Promise<Blueprint | undefined>
  set(blueprint: Blueprint): Promise<void>
  delete(filename: string): Promise<void>
  flush(): Promise<void>
}
