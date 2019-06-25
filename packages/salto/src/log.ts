export default interface Log {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    debug(message: string, ...args: any[]): void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    info(message: string, ...args: any[]): void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warn(message: string, ...args: any[]): void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error(message: string, ...args: any[]): void
}
