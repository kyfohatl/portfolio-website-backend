export function resetMockAndSetImplementation(mock: jest.Mock, implementation: any) {
  mock.mockReset()
  mock.mockImplementation(implementation)
}