import { loadUser } from './cognito'

export function tenantHeaders(): Record<string, string> {
  const tenantId = loadUser()?.tenantId
  return tenantId ? { 'X-Tenant-Id': tenantId } : {}
}