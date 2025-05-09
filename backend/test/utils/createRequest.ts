// test/utils/createRequest.ts
export function createRequest(input: string, init?: RequestInit): Request {
  return new Request(input, init);
}
