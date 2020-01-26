export type File = {
  filename: string
  buffer: string
  timestamp?: number
}

export type DirectoryStore = {
  list(): Promise<string[]>
  get(filename: string): Promise<File | undefined>
  set(file: File): Promise<void>
  delete(filename: string): Promise<void>
  flush(): Promise<void>
  mtimestamp(filename: string): Promise<number | undefined>
}
