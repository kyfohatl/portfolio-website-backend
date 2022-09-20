export function resetMockAndSetImplementation(mock: jest.Mock, implementation: any) {
  mock.mockReset()
  mock.mockImplementation(implementation)
}

// TODO: Does not infer types correctly
export function resetMockAndSetReturnValue(mock: jest.Mock, returnVal: any) {
  mock.mockReset()
  mock.mockReturnValue(returnVal)
}

// TODO: Does not infer types correctly
export function resetMockAndSetResolveValue(mock: jest.Mock, resolveVal: any) {
  mock.mockReset()
  mock.mockResolvedValue(resolveVal)
}